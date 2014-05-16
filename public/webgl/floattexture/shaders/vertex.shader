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
attribute vec4 tangent;

uniform vec3 view;
uniform vec2 dimensions;

varying vec3 worldPosition;
varying vec3 camera_position;

varying vec3 tsPosition;
varying vec3 tsCameraPosition;
varying vec3 vPosition;

void main(void) {
    vec3 vNormal;
    vec3 vTangent;
    vec3 vBinormal;

    vPosition = position * vec3 (dimensions, 1.);
    vUv = uv;

    vec4 worldPosition4 = modelViewMatrix * vec4 (position, 1.0);
    worldPosition = worldPosition4.xyz;
    camera_position = view;//cameraPosition;

    // sunDirection = normalize (projectionMatrix * modelViewMatrix * vec4 (sun, 1.0)).xyz;
    // Find & normalize the plane's normal, tangent, and binormal vectors
    vNormal = normalize( normal );
    vTangent = normalize( tangent.xyz );
    vBinormal = normalize( cross( vNormal, vTangent ) * tangent.w );
     
    // Convert vertice, camera, and light vector positions into tangent space
    mat3 TBNMatrix = mat3(vTangent, vBinormal, vNormal);
    tsPosition = position * TBNMatrix;
    tsCameraPosition = view * TBNMatrix;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4 (position, 1.0);
}
