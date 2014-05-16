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

var camera, scene, renderer, stats;

var sun, moon, water, land, boat, computers = [], sky, hemi_light, sky_light, sky_color;

var day_length = 60000,
    time = new Date().getTime(), 
    time_start = (-time + 0.75 * day_length),
    delta;

var MAX_CAMERA_DISTANCE = 30; /* meters */
var camera_distance = MAX_CAMERA_DISTANCE, camera_angle = (35 * Math.PI / 180);


var resize = (function() {
    var _timeout = 0;
    return function(e) {
        if (_timeout)
            clearTimeout(_timeout);
        _timeout = setTimeout(function (e) {
            _timeout = 0;
            camera.aspect = window.innerWidth /
                window.innerHeight;
            camera.updateProjectionMatrix ();
            
            /* Calculate the width of the water to fill the horizontal view
             * based on the FOV (three.js's camera.fov is vertical) */
            var fov = Math.atan (Math.tan (
                camera.fov * Math.PI / 180) * camera.aspect),
                Cx = camera.position.y + water.geometry.vertices[0].y,
                Cy = camera.position.z,
                D = Math.sqrt (Cx * Cx + Cy * Cy),
                w = 0.5 * D * Math.tan (fov);
            
            water.geometry.vertices[0].x = -w;
            water.geometry.vertices[1].x = w;
            water.geometry.vertices[2].x = -w;
            water.geometry.vertices[3].x = w;
            water.geometry.verticesNeedUpdate = true;
            water.geometry.normalsNeedUpdate = true;
            water.wake.setSize (water.geometry.vertices[1].x -
                                water.geometry.vertices[0].x,
                                water.geometry.vertices[0].y -
                                water.geometry.vertices[2].y);
            
            renderer.setSize (window.innerWidth,
                              window.innerHeight);
        }, 0);
    }
})();

var key_left = false, key_right = false, key_forward = false;

function keyDown (e) {
    switch (e.keyCode) {
    case 37: key_left = true; break;
    case 38: key_forward = true; break;
    case 39: key_right = true; break;
    }
}

function keyUp (e) {
    switch (e.keyCode) {
    case 37: key_left = false; break;
    case 38: key_forward = false; break;
    case 39: key_right = false; break;
    case 65:
        key_left = key_forward = key_right = false;
        break;
    default:
        console.log (e.keyCode);
        break;
    }
}
    
var rotateOnAxis = (function () {
    var quat = new THREE.Quaternion();
    return function (object, axis, angle) {
        quat.setFromAxisAngle(axis, angle);
        object.quaternion.multiply(quat);
    }
}) ();

var applyForceCount = 100;

function randomWakeColor() {
    var color = Math.floor(1 + Math.random() * 16) * 0x10000 +
            Math.floor(1 + Math.random() * 16) * 0x100 +
            Math.floor(1 + Math.random() * 8);
    color = color.toString(16);
    return '#' + color.replace(/^([0-9]{5})$/, '0$1');
}

function animate () {
    var now = Date.now ();
    delta = now - time;
    time = now;

    sky_update ();
    
    if (key_left) {
        boat.applyTorque(+5000000);
    }
    if (key_right) {
        boat.applyTorque(-5000000);
    }
    if (key_forward) {
        boat.applyForce(35000);
    } else {
        boat.applyForce(-25000);
    }

    boat.applyTime (delta);
    
    boat.mesh.position.x = 0;
    boat.mesh.position.y = 0;
    
    computers.forEach(function(computer) {
        computer.applyAI();
        computer.applyTime(delta);
        computer.mesh.quaternion.setFromAxisAngle (new THREE.Vector3(1, 0, 0), Math.PI * 0.5);
        rotateOnAxis (computer.mesh, new THREE.Vector3 (0, 1, 0), computer.a);
        computer.x -= boat.x;
        computer.y -= boat.y;
    });
    
    var collisions = [];
    computers.forEach(function(computer) {
        if (computer.x * computer.x + computer.y * computer.y < 
            Math.pow(computer.mesh.geometry.boundingSphere.radius * 0.35 + 
                     boat.mesh.geometry.boundingSphere.radius * 0.35, 2)) {
            collisions.push({ 
                x: computer.x, 
                y: computer.y, 
                r: computer.mesh.geometry.boundingSphere.radius 
            });
            computer.x = 50 * (Math.random() - 0.5);
            computer.y = 50 * (Math.random() - 0.5);
            computer.color = randomWakeColor();
        }
        computer.mesh.position.x = computer.x;
        computer.mesh.position.y = computer.y;
    });
    
    var camera_alpha = boat.V / boat.maxSpeed,
        a2 = camera_alpha * camera_alpha;
    camera_alpha = a2 / (a2 + Math.pow(1 - camera_alpha, 2));
    camera_distance = MAX_CAMERA_DISTANCE + camera_alpha * MAX_CAMERA_DISTANCE;
    camera_angle = (25 + 20 * camera_alpha) * Math.PI / 180;
    camera.position.set (
        0,
        Math.cos (camera_angle) * camera_distance,
        Math.sin (camera_angle) * camera_distance);
    camera.up = new THREE.Vector3 (0, 0, 1);
    camera.lookAt (new THREE.Vector3 (
        0, 0/*camera_distance * 0.25*/, 0));

    if (water) {
        water.wake.moveTo(-boat.x / 100, -boat.y / 100);
        boat.x = boat.y = 0;
        water.wake.setViewpoint (camera.position.x, camera.position.y, camera.position.z);
        water.wake.setSunColor (sky_light.color);
        water.wake.setSunPos (sky_light.position.x + 7500, sky_light.position.y, sky_light.position.z);
        water.wake.velocityAt(0, 0, 3,
                              10. * -boat.N.x * boat.V, 
                              10. * boat.N.y * boat.V);
        water.wake.colorAt (0, 0, 4, '#02022f');
        
        computers.forEach(function(computer) {
            water.wake.velocityAt(computer.x, computer.y, 3,
                                  10. * -computer.N.x * computer.V, 
                                  10. * computer.N.y * computer.V);
            water.wake.colorAt (computer.x, computer.y, 4, computer.color);
        });
        collisions.forEach(function(collision) {
            water.wake.colorAt(collision.x, collision.y, collision.r, '#f00');
        });
//        water.wake.colorAt (0, 0, 2, '#ffffff');
        water.wake.tick();
    }
    
    var plane = water;
    var vNormal = plane.geometry.faces[0].normal.clone (),
        vTangent = new THREE.Vector3 (
            plane.geometry.faces[0].vertexTangents[0].x,
            plane.geometry.faces[0].vertexTangents[0].y,
            plane.geometry.faces[0].vertexTangents[0].z),
        vBinormal = new THREE.Vector3 ().crossVectors (vTangent, vNormal).multiplyScalar (plane.geometry.faces[0].vertexTangents[0].w),
        TBNMatrix = new THREE.Matrix3 (vTangent.x, vTangent.y, vTangent.z,
                                       vBinormal.x, vBinormal.y, vBinormal.z,
                                       vNormal.x, vNormal.y, vNormal.z),
        tsPosition = new THREE.Vector3 (0.5, 0.5, 0.).applyMatrix3 (TBNMatrix),
        eye = camera.position.clone ().applyMatrix3 (TBNMatrix).normalize ();
    var bias = water.wake.getWaveBias ();
    var h = water.wake.getWaterDataAt (0.5, 0.5);
    var v = h[3] * bias.x - bias.y;
    boat.mesh.position.y += 0.25 * (v * water.geometry.vertices[2].y - boat.mesh.position.y);
    if (!('target_rock' in boat)) {
        boat.target_rock = 0;
    }
    var axis = new THREE.Vector3 (0, 0, 1),
        normal = new THREE.Vector3 (h[0], h[1], h[3] + 1.).normalize (),
        cp = axis.clone ().cross (normal),
        a = axis.dot (normal) * 0.5;

    boat.target_rock += 0.25 * (a - boat.target_rock);
    boat.mesh.quaternion.setFromAxisAngle (new THREE.Vector3(1, 0, 0), Math.PI * 0.5);
    rotateOnAxis (boat.mesh, new THREE.Vector3 (0, 1, 0), boat.a);
    //    rotateOnAxis (boat.mesh, new THREE.Vector3 (0, 1, 0), time * 2 * Math.PI / 10000);
    rotateOnAxis (boat.mesh, cp, boat.target_rock);


    
    render();

    requestAnimationFrame(animate);
}

function sky_update () {
    var sky_distance = 1000,
        sky_time = 2 * Math.PI * (time_start + time) / day_length,
        light_strength;
//    sky_time = 2 * Math.PI * (mouse.x + 0.25);
    sun.position.x = 0;
    sun.position.y = sky_distance * Math.sin (sky_time);
    sun.position.z = sky_distance * Math.cos (sky_time);
    sun.rotation.x = Math.PI-sky_time;
    
    sky_time += Math.PI;
    moon.position.x = 0;
    moon.position.y = sky_distance * Math.sin (sky_time);
    moon.position.z = sky_distance * Math.cos (sky_time);
    moon.rotation.x = Math.PI-sky_time;
    
    if (sun.position.z > 0) {
        sky_light.position.x = 0;
        sky_light.position.y = sun.position.y;
        sky_light.position.z = sun.position.z;
        light_strength = Math.min (sky_light.position.z / 200, 1);
        sky_light.color.setHSL (0.1, 1, light_strength);
        light_strength = Math.max (0.5, light_strength);        
        hemi_light.color.setHSL (0.6, 1, 0.6 * light_strength);
        hemi_light.groundColor.setHSL (0.095, 1, 0.75 * light_strength);    
    } else {
        sky_light.position.x = 0;
        sky_light.position.y = moon.position.y;
        sky_light.position.z = moon.position.z;
        light_strength = Math.min (sky_light.position.z / 200, 1);
        sky_light.color.setHSL (0.8, 0.8, light_strength);
        sky_color.setHSL (230 / 360, 1, 0.5 * (1. - light_strength));
        renderer.setClearColor (sky_color, 1);
        light_strength = Math.max (0.5, light_strength);
        hemi_light.color.setHSL (0.6, 1, 0.6 * light_strength);
        hemi_light.groundColor.setHSL (0.095, 1, 0.75 * light_strength);
    }
}

var mouse = {
    x: 0,
    y: 0
};

document.addEventListener ('DOMContentLoaded', function() {
    window.addEventListener('resize', resize);
    window.addEventListener ('mousemove', function (e) {
        mouse.x = e.clientX / window.innerWidth;
        mouse.y = e.clientY / window.innerHeight;
    });
    camera = new THREE.PerspectiveCamera(
        45, 4 / 3, 0.1, 10000);
    
    camera.position.set (
        0,
        Math.cos (camera_angle) * camera_distance,
        Math.sin (camera_angle) * camera_distance);
    camera.up = new THREE.Vector3 (0, 0, 1);
    camera.lookAt (new THREE.Vector3 (
        0, camera_distance * 0.25, 0));
    renderer = new THREE.WebGLRenderer({
        antialias: false,
        canvas: document.getElementById ('canvas'),
        preserveDrawingBuffer: true
    });
    
    sky_color = new THREE.Color ().setHSL (230 / 360, 1, 0.5);
    renderer.setClearColor(sky_color, 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = true;
    
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);

    scene = new THREE.Scene();  
//    scene.fog = new THREE.Fog (
//        0x5082a5, camera_distance, camera_distance * 2);

    hemi_light = new THREE.HemisphereLight (0xffffff, 0xffffff, 1);
    hemi_light.color.setHSL (0.8, 1, 0.8);
    hemi_light.groundColor.setHSL (0.295, 1, 0.75);
    hemi_light.position.set (0, 1000, 0);
    scene.add (hemi_light);

    sky_light = new THREE.DirectionalLight(0xffffff, 1);
    sky_light.color.setHSL (0.1, 1, 0.95);
    sky_light.position.set (0, 0, 0);
    sky_light.position.multiplyScalar( 50 );
    sky_light.position.set(0, 0, 0);
    scene.add(sky_light);

    sun = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 1, 1),
        new THREE.MeshBasicMaterial({
            map: new THREE.ImageUtils.loadTexture ('assets/sun.png'),
            transparent: true
        })
    );
    scene.add (sun);
    
    moon = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 1, 1),
        new THREE.MeshBasicMaterial({ 
            map: new THREE.ImageUtils.loadTexture ('assets/moon.png'),
            transparent: true
        })
    );
    scene.add (moon);

    var wake = new Wake (renderer, 512, 512, function (texture) {
        water = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 300, 1, 1),
            new THREE.MeshBasicMaterial({
                map: texture
                /*transparent: true, opacity: 0.9*/ 
            })
        );
        water.wake = wake;
        water.geometry.computeFaceNormals ();
        water.geometry.computeTangents ();
        water.position.x = water.position.y = 0;
        resize ();
        scene.add (water);
        animate ();
    });

    boat = new Boat ('sea-rose.js', function () {
        scene.add (boat.mesh);
    });
    boat.maxSpeed = 12; /* Default is 10m/s */
    
    for (var i = 0; i < 2; i++) {
        computers.push(new Boat('sea-rose.js', function() {
            this.color = randomWakeColor();
            this.x = 50 * (Math.random() - 0.5);
            this.y = 50 * (Math.random() - 0.5);
            this.mesh.position.x = this.x;
            this.mesh.position.y = this.y;
            this.maxSpeed *= 1. - (Math.random() * 0.4); /* Random speed as slow as 60% */
            scene.add(this.mesh);
        }));
    }
    
    setTimeout (function () {
        window.addEventListener ('keydown', keyDown, false);
        window.addEventListener ('keyup', keyUp, false);
    }, 500);    
});

function render() {
    renderer.render (scene, camera);
    stats.update ();
}
