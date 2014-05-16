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
uniform sampler2D sampler_p;
uniform float pressure_decay;

uniform vec2 offset;

void main(void) {
    float p = border_zero_sample (sampler_p, vUv + offset).r;
    gl_FragColor.r = p * pressure_decay;
}
