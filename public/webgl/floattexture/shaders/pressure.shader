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

void main(void){
	vec2 v = texture2D (sampler_v, vUv).rg;

    /* Difference in velocity is taken from the left sample for X and up for Y */
    float v_x = border_zero_sample (sampler_v, vUv - vec2(1.,0.)*pixelSize).r;
	float v_y = border_zero_sample (sampler_v, vUv - vec2(0.,1.)*pixelSize).g;

    float n = border_zero_sample (sampler_p, vUv - pixelSize*vec2(0.,1.)).r;
	float s = border_zero_sample (sampler_p, vUv + pixelSize*vec2(0.,1.)).r;
	float w = border_zero_sample (sampler_p, vUv + pixelSize*vec2(1.,0.)).r;
	float e = border_zero_sample (sampler_p, vUv - pixelSize*vec2(1.,0.)).r;

    float p = ( n + w + s + e) * .25 - (v.x - v_x + v.y - v_y) * 0.25;

    gl_FragColor.r = p;
}
