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
precision highp float;

varying vec2 vUv;
uniform vec4 rnd;
uniform float time;

/* returns RGBA data from sampler or zero out of bounds */
/* Perhaps optimize this by putting a 0 border around the texture sample
 * and then clamping? */
vec4 border_zero_sample(sampler2D sampler, vec2 uv) {
    if (uv.x < 0. || uv.x >= 1. || uv.y < 0. || uv.y >= 1.)
        return vec4 (0.);
    return texture2D (sampler, uv);
}