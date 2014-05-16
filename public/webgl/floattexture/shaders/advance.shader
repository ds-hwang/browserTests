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
uniform sampler2D sampler_prev;
uniform sampler2D sampler_v;
uniform sampler2D sampler_noise;
uniform sampler2D origin;
uniform sampler2D color;
uniform vec2 water_offset;

uniform vec2 pixelSize;
uniform vec2 texSize;
uniform vec2 offset;

/* returns RGBA data from A or B if out of bounds */
vec4 border_a_or_b (sampler2D a, sampler2D b, vec2 uv, vec2 uv2) {
    if (uv.x < 0. || uv.x >= 1. || uv.y < 0. || uv.y >= 1.) {
        return texture2D(b, uv2);
    }
    return texture2D(a, uv);
}

void main(void) {
    vec2 motion = texture2D(sampler_v, vUv).rg * pixelSize;
    vec2 uv = vUv - motion; // add fluid motion

    vec4 rand_noise = texture2D(sampler_noise, uv + vec2(rnd.x, rnd.y));

    /* Add error-diffusion dithering and adjust for texture movement */
    uv += (rand_noise.yz - 0.5) * pixelSize;
    gl_FragColor = border_a_or_b(sampler_prev, origin, uv + offset, 
        (uv + water_offset)) + (rand_noise - 0.5) * 1./256.;

    /* Fade back to the original color value over time... */
    gl_FragColor = mix(texture2D (origin, uv + water_offset), gl_FragColor, 0.995);
    gl_FragColor.a = 1.;

    /* Add in the color map provided from the JS side */
    vec3 map = texture2D(color, vUv).rgb;
    gl_FragColor.rgb += map;
}
