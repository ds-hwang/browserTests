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
uniform vec2 pixelSize;
uniform sampler2D sampler_v;
uniform sampler2D sampler_p;

void main(void) {
    float p = texture2D (sampler_p, vUv).r;
    vec2 v = texture2D (sampler_v, vUv).rg;
    float p_x = border_zero_sample (sampler_p, vUv + vec2(1.,0.)*pixelSize).r;
    float p_y = border_zero_sample (sampler_p, vUv + vec2(0.,1.)*pixelSize).r;
    v -= (vec2 (p_x, p_y) - p) * 0.25;
    gl_FragColor.rg = v;
}
