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
uniform sampler2D velocity;
uniform float velocity_decay;
uniform float delta;
uniform sampler2D disruption;

void main (void) {
    /* Update the position based on the amount of time passed 
     * times the velocity for this position */
    vec2 v = vUv - pixelSize * texture2D(sampler_v, vUv).rg * delta;
    
    /* Set the velocity based on that updated position */
    v = texture2D(sampler_v, v).rg;
    
    /* add in the velocity map from the JS side */
    vec3 map = texture2D (velocity, vUv).rga;
    v = mix (v, (map.rg - 0.5) * 5., map.b);

    /* Decay velocity back to zero (we aren't frictionless) */
    gl_FragColor.rg = v * velocity_decay;
}
