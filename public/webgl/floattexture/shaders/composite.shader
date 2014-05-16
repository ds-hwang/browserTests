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
uniform sampler2D origin;
uniform sampler2D sampler_prev;
uniform sampler2D source;

uniform vec2 pixelSize;
uniform vec2 aspect;
uniform vec2 light_pos;
uniform vec2 texSize;
uniform float boatAngle;
uniform vec3 sun;

uniform vec3 view;

varying vec3 vPosition;

varying vec3 worldPosition;
varying vec3 camera_position;

const vec3 ambientColor = vec3 (.5, .5, .5); // color of ambient light
const vec3 diffuseColor = vec3 (.8, .8, .8); // color of diffuse lighting
const vec3 specularColor = vec3 (1.1, 1.1, 1.1); // color of specular highlights

uniform vec2 wave_bias;

varying vec3 tsPosition;
varying vec3 tsCameraPosition;

uniform vec3 sun_color;
uniform sampler2D water_origin;
uniform vec2 water_offset;

const float wake_scale = 3.;

vec4 getNoise(vec2 uv){
    float t = time * 0.25;
    vec2 uv0 = (uv / 103.0) + vec2 (t / 17.0, t / 29.0);
    vec2 uv1 = uv / 107.0 - vec2 (t / -19.0, t / 31.0);
    vec2 uv2 = uv / vec2 (897.0, 983.0) + vec2 (t / 101.0, t / 97.0);
    vec2 uv3 = uv / vec2 (991.0, 877.0) - vec2 (t / 109.0, t / -113.0);
    vec4 noise = (texture2D (water_origin, uv0)) +
                 (texture2D (water_origin, uv1)) +
                 (texture2D (water_origin, uv2)) +
                 (texture2D (water_origin, uv3));
    return noise * 0.25 - 1.0;
}

void main(void) {
    vec2 pos;
    vec3 sunDirection;
 
    pos = vUv * wake_scale;

    vec3 eye;

    // calculate the height for this pixel position
    float height = getNoise ((pos + water_offset) * 100.).a;
    float v = height * wave_bias.x - wave_bias.y;
 
    // normalize the camera's tangent space position
    eye = normalize(tsCameraPosition);
    
    // Determine new position based on height field (parallax)
    vec2 newCoords = pos + (eye.xy * v) * wake_scale;

    float l = length (vUv - 0.5);
    vec3 color;
    /* The texture color used for the water will be the original water
     * texture at distance > 0.16, it will be the fluid simulation color
     * for distances < 0.14, and a blend between those two distances */
    if (l > 0.16)
        color = texture2D(origin, newCoords + water_offset).rgb;
    else if (l < 0.14)
        color = texture2D(sampler_prev, newCoords).rgb; // active color
    else
        color = mix (texture2D(sampler_prev, newCoords).rgb,
                    texture2D(origin, newCoords + water_offset).rgb,
                    min ((l - 0.14) / 0.02, 1.));

    vec3 normal = normalize (vec3 (getNoise ((newCoords + water_offset) * 100.).rg + 0.5, height));
    eye = normalize (view - vPosition * 10.);
    vec3 sunReflection = reflect (normalize (vPosition * 10. - sun), normal);
    float shininess = 10.;
    float angle = max (0., dot (eye, sunReflection));
    vec3 specular_color = pow (angle, shininess) * specularColor;
    vec3 diffuse_color = max (dot (sunDirection, normal), 0.) * diffuseColor;
    gl_FragColor.rgb = mix (color * 3., (diffuse_color + specular_color) * sun_color, 0.75);

    gl_FragColor.a = 1.;
    
    return;
}
