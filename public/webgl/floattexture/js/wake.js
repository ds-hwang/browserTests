/*

Copyright 2013-2014 Intel Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/
"use strict";

/*
 * The fluid simulation in Yar! is based on the excellent paper:
 * Fast Fluid Dynamics Simulation on the GPU by Mark J. Harris
 * http://http.developer.nvidia.com/GPUGems/gpugems_ch38.html
 *
 * It has been adapted to inject velocity and color
 * into the simulation. A noise variance is used when 
 * selecting the color to render at a given position as well;
 * this helps to create a diffused silt look.
 *
 */
var Wake = function (renderer, w, h, callback, full) {
    var that = this;

    var init_random = true;
    var surface;
    var FBO_main, FBO_main2,
        FBO_fluid_v, FBO_fluid_backbuffer,
        FBO_fluid_p;
    var uniforms;
    var scene, camera;
    var simScale = 2;

    var velocity_context = null,
        color_context = null;

    var shaderLoader = null;
    
    var sizeX = w, sizeY = h,
        light = new THREE.Vector2(0.75, 0.5);
    var boatAngle = 0,
        wind = new THREE.Vector2(0, 0),
        grid_texture;
    var wakeFBO = null;

    var composite_material,
        advance_material,
        fluid_advect_material,
        fluid_velocity_offset_material,
        fluid_init_material,
        copy_material,
        pressure_add_material,
        pressure_material,
        div_material;

    this.pressure_decay = 0.;
    this.velocity_decay = 0;
    this.wave_bias = .1125;

    this.getWaveBias = function () {
        return uniforms.wave_bias.value.clone ();
    }
    
    this.distort_p = 0;

    function decode (rg) {
        var v = 0.;
        var ix = rg[0];
        var iy = rg[1];
        var s = (ix >= 128) ? 1 : -1;
        ix = (s > 0) ? ix - 128 : ix;
        var iexp = Math.floor (ix / 8);
        var msb = Math.floor (ix - iexp * 8);
        norm = (iexp == 0) ? 0 : 2048;
        mantissa = norm + msb * 256 + iy;
        norm = (iexp == 0) ? 1 : 0;
        exponent = Math.pow( 2., iexp + norm - 20.);
        v = s * mantissa * exponent;
        return v;
    }

    this.setSize = function (w, h) {
        uniforms.dimensions.value.x = Math.abs (w * 0.5);
        uniforms.dimensions.value.y = Math.abs (h * 0.5);
    }
    
    uniforms = {
        dimensions: { type: 'v2', value: new THREE.Vector3 () },
        view: { type: 'v3', value: new THREE.Vector3 () },
        sun: { type: 'v3', value: new THREE.Vector3 () },
        sun_color: { type: 'v3', value: new THREE.Vector3 () },
        water_offset: { type: 'v2', value: new THREE.Vector2 () },
        water_origin: { type: 't', value: undefined },
        offset: { type: 'v2', value: new THREE.Vector2 () },
        offset_fraction: { type: 'v2', value: new THREE.Vector2 () },
        height_map: { type: 'f', value: 0. },

        velocity: { type: 't', value: undefined },
        color: { type: 't', value: undefined },

        pressure_decay: { type: "f", value: undefined },
        wave_bias: { type: "v2", value: new THREE.Vector2 () },
        velocity_decay: { type: "f", value: undefined },
        current: { type: "v2", value: new THREE.Vector2 () },
        rnd: { type: "v4", value: new THREE.Vector4 () },
        texSize: { type: "v2", value: new THREE.Vector2() },
        pixelSize: { type: "v2", value: new THREE.Vector2() },
        aspect: { type: "v2", value: new THREE.Vector2() },
        light_pos : { type: "v2", value: new THREE.Vector2 () },
        time: { type: "f", value: undefined },
        delta: { type: "f", value: undefined },
        sampler_prev: { type: "t", value: undefined },
        sampler_noise: { type: "t", value: undefined },
        sampler_v: { type: "t", value: undefined },
        sampler_p: { type: "t", value: undefined },
        source: { type: "t", value: undefined },
        origin: { type: "t", value: undefined },
    };

    this.init = function () {
        surface.material = fluid_init_material;
        renderer.render(scene, camera, FBO_fluid_v, true);
        renderer.render(scene, camera, FBO_fluid_p, true);
        renderer.render(scene, camera, FBO_fluid_backbuffer, true);

        surface.material = copy_material;
        if (init_random) {
            uniforms.source.value = uniforms.water_origin.value;//uniforms.sampler_noise.value;
        } else {
            uniforms.source.value = grid_texture;
        }
        renderer.render(scene, camera, FBO_main, true);
        renderer.render(scene, camera, FBO_main2, true);
    }

    function newFBO (w, h, scale, filter, type) {
        scale = scale !== undefined ? scale : 1;

        var texture = new THREE.WebGLRenderTarget(w / scale, h / scale, {
            unpackAlignment: 1,
            minFilter: filter !== undefined ? filter : THREE.NearestFilter,
            magFilter: filter !== undefined ? filter : THREE.NearestFilter,
            type: type !== undefined ? type : THREE.UnsignedByteType,
            format: THREE.RGBAFormat
        });
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.generateMipmaps = false;
        return texture;
    }

    var oldX = 0, oldY = 0, dX, dY;
    this.position = { x: 0, y: 0 };
    this.rounded_position = { x: 0, y: 0 };
    this.moveTo = function (x, y) {
        uniforms.water_offset.value.x -= x;
        uniforms.water_offset.value.y -= y;
        this.position.x += x * sizeX;
        this.position.y += y * sizeY;
        x = Math.floor (this.position.x);
        y = Math.floor (this.position.y);
        uniforms.offset.value.x = (this.rounded_position.x - x) / sizeX;
        uniforms.offset.value.y = (this.rounded_position.y - y) / sizeY;
        this.rounded_position.x = x;
        this.rounded_position.y = y;
        uniforms.offset_fraction.value.x = this.position.x - uniforms.offset.value.x;
        uniforms.offset_fraction.value.y = this.position.y - uniforms.offset.value.y;
    }

    function createContexts () {
        var canvas, texture;
        canvas = document.createElement ('canvas');
        canvas.width = sizeX / simScale;
        canvas.height = sizeY / simScale;   
        texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
		texture.repeat.set( 1, 1 );
        uniforms.velocity.value = texture;
        velocity_context = canvas.getContext ('2d');

        canvas = document.createElement ('canvas');
        canvas.width = sizeX / simScale;
        canvas.height = sizeY / simScale;   
        texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
		texture.repeat.set( 1, 1 );
        uniforms.color.value = texture;
        color_context = canvas.getContext ('2d');
    }

    this.velocityAt = function (x, y, r, dx, dy) {
        x = 0.5 + 1.5 * x / uniforms.dimensions.value.x;
        y = 0.5 + 1.5 * y / uniforms.dimensions.value.y;
        r /= uniforms.dimensions.value.x;
        velocity_context.fillStyle = 'rgba('+
            Math.floor(128 + (dx / uniforms.dimensions.value.x) * 127)+','+
            Math.floor(128 + (dy / uniforms.dimensions.value.y) * 127)+','+
            '0, 1)';
        velocity_context.beginPath ();
        velocity_context.arc (x * sizeX / simScale, 
                              (1. - y) * sizeX / simScale, 
                              r * sizeX / simScale, 0, Math.PI * 2);
        velocity_context.fill ();
    }
    
    this.colorAt = function (x, y, r, color) {
        x = 0.5 + 1.5 * x / uniforms.dimensions.value.x;
        y = 0.5 + 1.5 * y / uniforms.dimensions.value.y;
        r /= uniforms.dimensions.value.x;
        color_context.fillStyle = color;
        color_context.beginPath ();
        color_context.arc (x * sizeX / simScale, 
                           (1. - y) * sizeX / simScale, 
                           r * sizeX / simScale, 0, Math.PI * 2);
        color_context.fill ();
        return;
    }
    this.setLight = function (x, y) {
        uniforms.light_pos.value.x = x;
        uniforms.light_pos.value.y = y;
    }

    this.setViewpoint = function (x, y, z) {
        uniforms.view.value.x = x;
        uniforms.view.value.y = y;
        uniforms.view.value.z = z;
    }

    var last_time = Date.now ();
    this.tick = function () {
        var elapsed = Date.now () - last_time;
        last_time = Date.now ();

        /* Fade out the velocity within ~2.5 seconds */
        that.velocity_decay = Math.round (2500 / elapsed);
        setUniforms ();

        advance ();
        composite ();

        velocity_context.clearRect (0, 0, sizeX, sizeY);
        color_context.clearRect(0, 0, sizeX, sizeY);
        
        even_pass = !even_pass;

        uniforms.offset.value.x = 0;
        uniforms.offset.value.y = 0;
        uniforms.offset_fraction.value.x = uniforms.offset_fraction.value.y = 0;

        uniforms.color.value.needsUpdate = uniforms.velocity.value.needsUpdate = true;
    }

    /*
it's working and not crashing (minus this text)
next... make the fragment shaders use the color and velocity maps to adjust the velocity render
sequence instead of the disruptions[] array thing.
*/
    var even_pass = true;
    var start_time = Date.now ();

    this.setSunPos = function (x, y, z) {
        uniforms.sun.value.x = x;
        uniforms.sun.value.y = y;
        uniforms.sun.value.z = z;
    }

    this.setSunColor = function (rgb) {
        if (rgb instanceof THREE.Color) {
            uniforms.sun_color.value.x = rgb.r;
            uniforms.sun_color.value.y = rgb.g;
            uniforms.sun_color.value.z = rgb.b;
        } else
            uniforms.sun_color.value = rgb;
    }

    function setUniforms() {
        uniforms.wave_bias.value.x = that.wave_bias;
        uniforms.wave_bias.value.y = -.0775;
        if (that.pressure_decay == 0.)
            uniforms.pressure_decay.value = 1.;
        else
            uniforms.pressure_decay.value =
                (that.pressure_decay - 1.) / that.pressure_decay;
        if (that.velocity_decay == 0.)
            uniforms.velocity_decay.value = 1.;
        else
            uniforms.velocity_decay.value =
                (that.velocity_decay - 1.) / that.velocity_decay;

        var last = uniforms.time.value;
        uniforms.time.value = (Date.now () - start_time) / 1000.;
        uniforms.delta.value = (uniforms.time.value - last) / 100;
        
        uniforms.rnd.value.x = Math.random ();
        uniforms.rnd.value.y = Math.random ();
        uniforms.rnd.value.z = Math.random ();
        uniforms.rnd.value.w = Math.random ();

        uniforms.aspect.value.x = Math.max(1, sizeX / sizeY);
        uniforms.aspect.value.y = Math.max(1, sizeY / sizeX);
    }

    function addVelocityOffset () {
        /* Advances the fluid_v => fluid_backbuffer by 'uniforms.offset' */
        surface.material = fluid_velocity_offset_material;
        uniforms.sampler_v.value = FBO_fluid_v;
        renderer.render(scene, camera, FBO_fluid_backbuffer, true);
    }

    function advect () {
        surface.material = fluid_advect_material;
        uniforms.sampler_v.value = FBO_fluid_backbuffer;
        renderer.render(scene, camera, FBO_fluid_v, true);
    }

    var color_buffer = new Uint8Array (4);

    function diffuse () {
        var x = uniforms.offset.value.x;
        var y = uniforms.offset.value.y;

        surface.material = pressure_add_material;
        uniforms.sampler_p.value = FBO_fluid_p;
        renderer.render (scene, camera, FBO_fluid_backbuffer, true);

        uniforms.offset.value.x = 0;
        uniforms.offset.value.y = 0;

        surface.material = pressure_material;
        uniforms.sampler_v.value = FBO_fluid_v;

//        for ( var i = 0; i < 8; i++) {
            uniforms.sampler_p.value = FBO_fluid_backbuffer;
            renderer.render (scene, camera, FBO_fluid_p, true);

            uniforms.sampler_p.value = FBO_fluid_p;
            renderer.render (scene, camera, FBO_fluid_backbuffer, true);
//        }

        surface.material = copy_material;
        uniforms.source.value = FBO_fluid_backbuffer;
        renderer.render (scene, camera, FBO_fluid_p, true);

        uniforms.offset.value.x = x;
        uniforms.offset.value.y = y;
        var gl = renderer.getContext ();

        surface.material = div_material;
        uniforms.sampler_p.value = FBO_fluid_p;
        renderer.render (scene, camera, FBO_fluid_backbuffer, true);

        surface.material = copy_material;
        uniforms.source.value = FBO_fluid_backbuffer;
        renderer.render (scene, camera, FBO_fluid_v, true);
    }

    function getImageData( image ) {
        var canvas = document.createElement( 'canvas' );
        canvas.width = image.width;
        canvas.height = image.height;
    
        var context = canvas.getContext( '2d' );
        context.drawImage( image, 0, 0 );
    
        return context.getImageData( 0, 0, image.width, image.height );
    }

    var water_image_data = null;
    
    function mix (x, y, a) {
        return x * (1. - a) + y * a;
    }
    function getWaterAt (x, y) {
//        console.log ('x: ' + x + ' y: ' + y);
        while (x < 0)
            x += 1.;
        while (x >= 1.)
            x -= 1.;
        while (y < 0)
            y += 1.;
        while (y >= 1.)
            y -= 1.;
        y = 1. - y;
/*
        // NEAREST filter
        return water_image_data.data[
            (Math.floor (y * water_image_data.height) * water_image_data.width + 
             Math.floor (x * water_image_data.width)) * 4 + 3] / 255;
*/
        y *= water_image_data.height;
        var yd = 1. - (y - Math.floor (y));
        x *= water_image_data.width;
        var xd = 1. - (x - Math.floor (x));

        // LINEAR filter
        x = Math.floor (x);
        y = Math.floor (y);
        
        var h = [];
        for (i = 0; i < 4; i++) {
            var p0 = water_image_data.data[(y * water_image_data.width + x) * 4 + i],
                p1 = water_image_data.data[(y * water_image_data.width + (x + 1)) * 4 + i],
                p2 = water_image_data.data[((y + 1) * water_image_data.width + x) * 4 + i],
                p3 = water_image_data.data[((y + 1) * water_image_data.width + (x + 1)) * 4 + i];
            h[i] = mix (mix (p0, p1, xd), mix (p2, p3, xd), yd) / 256;
        }
        return h;
    }

    this.getWaterDataAt = function (x, y) {
        if (water_image_data == null)
            return 0;

        x *= 3.;
        y *= 3.;
        x += uniforms.water_offset.value.x;
        y += uniforms.water_offset.value.y;
        x *= 100.;
        y *= 100.;
        
        var t = uniforms.time.value * 0.25,
            uv0 = { x: x / 103. + t / 17.,
                    y: y / 103. + t / 29. },
            uv1 = { x: x / 107 - t / -19,
                    y: y / 107 - t / 31 },
            uv2 = { x: x / 897 + t / 101,
                    y: y / 983 + t / 97 },
            uv3 = { x: x / 991 - t / 109,
                    y: y / 877 - t / -113 };
        var h1 = getWaterAt (uv0.x, uv0.y),
            h2 = getWaterAt (uv1.x, uv1.y),
            h3 = getWaterAt (uv2.x, uv2.y),
            h4 = getWaterAt (uv3.x, uv3.y);
        var h = [];
        for (var i = 0; i < 4; i++) {
            h[i] = (h1[i] + h2[i] + h3[i] + h4[i]) * 0.25 - 1;
        }
        return h;
    }

    function advance () {
        uniforms.pixelSize.value.x = 1. / (sizeX / simScale);
        uniforms.pixelSize.value.y = 1. / (sizeY / simScale);
        uniforms.texSize.value.x = sizeX / simScale;
        uniforms.texSize.value.y = sizeY / simScale;

        addVelocityOffset ();   // Advances sampler_v 'offset' pixels
        advect ();
        diffuse ();     // Advances sampler_p 'offset' pixels

        uniforms.pixelSize.value.x = 1. / sizeX;
        uniforms.pixelSize.value.y = 1. / sizeY;
        uniforms.texSize.value.x = sizeX;
        uniforms.texSize.value.y = sizeY;

        /* Uses:
         * sampler_prev
         * sampler_v
         * sampler_noise
         */
        surface.material = advance_material;
        uniforms.sampler_v.value = FBO_fluid_v;

        if (even_pass) {
            uniforms.sampler_prev.value = FBO_main;
            renderer.render(scene, camera, FBO_main2, true);
        } else {
            uniforms.sampler_prev.value = FBO_main2;
            renderer.render(scene, camera, FBO_main, true);
        }

        uniforms.offset.value.x = uniforms.offset.value.y = 0;
    }

    function composite () {
        surface.material = composite_material;

        /* Uses:
         * sampler_prev
         */
        uniforms.pixelSize.value.x = 1. / sizeX;
        uniforms.pixelSize.value.y = 1. / sizeY;
        uniforms.texSize.value.x = sizeX;
        uniforms.texSize.value.y = sizeY;

        uniforms.offset.value.x = (that.rounded_position.x - that.position.x) / sizeX;
        uniforms.offset.value.y = (that.rounded_position.y - that.position.y) / sizeY;

        if (even_pass) {
            uniforms.sampler_prev.value = FBO_main2;
        } else {
            uniforms.sampler_prev.value = FBO_main;
        }

        renderer.render(scene, camera, wakeFBO, true);
    }


    camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10000, 10000);
    camera.position.z = 100;

    scene = new THREE.Scene();

    wakeFBO = newFBO (sizeX, sizeY, 1, THREE.LinearFilter);

    var buffer = new Uint8Array(sizeX * sizeY * 4); // RGBa
    for (var i = 0; i < buffer.length / 4; i++) {
        buffer[i * 4 + 0] = Math.random() * 0xff;
        buffer[i * 4 + 1] = Math.random() * 0xff;
        buffer[i * 4 + 2] = Math.random() * 0xff;
        buffer[i * 4 + 3] = 0xff;
    }

    uniforms.sampler_noise.value = new THREE.DataTexture(buffer, sizeX, sizeY);
    uniforms.sampler_noise.value.needsUpdate = true;
    uniforms.sampler_noise.value.wrapT = THREE.RepeatWrapping;
    uniforms.sampler_noise.value.wrapS = THREE.RepeatWrapping;

    uniforms.water_origin.value = new THREE.ImageUtils.loadTexture('assets/water.png');
    uniforms.water_origin.value.needsUpdate = true;
    uniforms.water_origin.value.wrapT = THREE.RepeatWrapping;
    uniforms.water_origin.value.wrapS = THREE.RepeatWrapping;
    uniforms.water_offset.value.x = 0;
    uniforms.water_offset.value.y = 0;
    uniforms.water_offset.minFilter = uniforms.water_offset.magFilter = THREE.LinearFilter;
    uniforms.water_origin.value.image.addEventListener ('load', function () {
        water_image_data = getImageData (this);
    });

    uniforms.origin.value = new THREE.ImageUtils.loadTexture('assets/origin.png');
    uniforms.origin.value.needsUpdate = true;
    uniforms.origin.value.wrapT = THREE.RepeatWrapping;
    uniforms.origin.value.wrapS = THREE.RepeatWrapping;

    buffer = new Uint8Array(sizeX * sizeY * 4); // RGBa
    var cX = Math.floor (sizeX / 64);
    var cY = Math.floor (sizeY / 64);
    for (var j = 0; j < sizeY; j++) {
        for (i = 0; i < sizeX; i++) {
            var c = Math.round (i / cX),
                r = Math.round (j / cY),
                color = (!((j + 8) % (cY - 1)) ||
                         !((i + 8) % (cX - 1))) ? 0xff : 0x00;
            buffer[i * 4 + j * sizeX * 4 + 0] = color;
            buffer[i * 4 + j * sizeX * 4 + 1] = color;
            buffer[i * 4 + j * sizeX * 4 + 2] = color;
            buffer[i * 4 + j * sizeX * 4 + 3] = 0xff;
        }
    }
    grid_texture = new THREE.DataTexture (buffer, sizeX, sizeY);
    grid_texture.needsUpdate = true;
    grid_texture.wrapT = THREE.RepeatWrapping;
    grid_texture.wrapS = THREE.RepeatWrapping;

    FBO_main = newFBO (sizeX, sizeY, 1, THREE.LinearFilter);
    FBO_main2 = newFBO (sizeX, sizeY, 1, THREE.LinearFilter);

    if (renderer.supportsFloatTextures()) {
        console.log ('Using FLOAT textures');
        if (!renderer.context.getExtension( 'OES_texture_float_linear' )) {
            document.body.innerHTML = 'Need to support float_nearest...';
            return;
        }
    } else {
        document.body.innerHTML = 'Need to find float encoding routine';
        return;
    }

    FBO_fluid_v = newFBO (sizeX, sizeY, simScale, THREE.LinearFilter, THREE.FloatType);
    FBO_fluid_v.flipY = true;
    FBO_fluid_backbuffer = newFBO (sizeX, sizeY, simScale, THREE.LinearFilter, THREE.FloatType);
    FBO_fluid_backbuffer.flipY = true;
    FBO_fluid_p = newFBO (sizeX, sizeY, simScale, THREE.LinearFilter, THREE.FloatType);
    FBO_fluid_p.flipY = true;

    shaderLoader = new ShaderLoader('shaders');
    
    shaderLoader.noCache = 'd=' + Date.now();
    shaderLoader.add('vertex', 'x-shader/x-vertex');
    shaderLoader.add('inc');
    shaderLoader.add('init');
    shaderLoader.add('copy');
    shaderLoader.add('velocity-offset');
    shaderLoader.add('advect');
    shaderLoader.add('advance');
    shaderLoader.add('pressure');
    shaderLoader.add('pressure-add');
    shaderLoader.add('divide');
    shaderLoader.add('composite');

    function makeMaterial (shader) {
        return new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: shaderLoader.get('inc').source + "\n" +
                shaderLoader.get('vertex').source,
            fragmentShader: shaderLoader.get('inc').source + "\n" +
                shaderLoader.get('' + shader).source
        });
    }
    
    createContexts ();

    shaderLoader.load(function (done) {
        console.log(Math.round(done * 100) + '%');

        if (done < 1.)
            return;

        composite_material = makeMaterial ('composite');
        advance_material = makeMaterial ('advance');
        fluid_advect_material = makeMaterial ('advect');
        fluid_velocity_offset_material = makeMaterial ('velocity-offset');
        fluid_init_material = makeMaterial ('init');
        copy_material = makeMaterial ('copy');
        pressure_add_material = makeMaterial ('pressure-add');
        pressure_material = makeMaterial ('pressure');
        div_material = makeMaterial ('divide');

        surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), composite_material);
        surface.geometry.computeVertexNormals();
        surface.geometry.computeTangents();
        scene.add(surface);

        that.init ();

        callback(wakeFBO);
    });

}
