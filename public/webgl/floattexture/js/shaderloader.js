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
var ShaderLoader = function (path) {
    var shaders = {},
        shaderScript, source, k,
        NONE = 0,
        LOADING = 1,
        DONE = 2,
        ERROR = -1,
        noCache = '';
    
    path = path.replace(/([^\/]$)/, '$1/');
    console.log(path);
    this.add = function (id, type) {
        var file = path + id + '.shader';
        if (typeof type === 'undefined')
            type = 'x-shader/x-fragment';
        if (type != 'x-shader/x-fragment' && type != 'x-shader/x-vertex') {
            console.error ('Invalid shader type requested.');
            return null;
        }
        shaders[id] = {
            file: file,
            type: type,
            source: "",
            status: ShaderLoader.NONE
        }
        return shaders[id];
    }

    this.get = function (id) {
        if (shaders[id]) {
            return shaders[id];
        }
        shaderScript = document.getElementById(id);
        if (shaderScript == null) {
            console.warn ('Shader "'+id+'" not found.');
            return NULL;
        }

        source = "";
        k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3)
                source += k.textContent;
            k = k.nextSibling;
        }

        return {
            type: shaderScript.type,
            file: "",
            status: ShaderLoader.DONE,
            source: source
        }
    }

    this.load = function (progress) {
        var i = 0, keys = Object.keys(shaders), xhr, m = keys.length;
        if (m == 0) {
            progress (1.);
            return;
        }
        progress (i / m);
        Object.keys(shaders).forEach(function(key) {
            var xhr = new XMLHttpRequest, shader = shaders[key];
            shader.status = ShaderLoader.LOADING;
            xhr.onload = (function (progress) {
                return function (e) {
                    if (e.currentTarget.status != 200)
                        return;
                    xhr = null;
                    shader.source = e.currentTarget.response ?
                        e.currentTarget.response :
                        e.currentTarget.responseText;
                    shader.status = ShaderLoader.DONE;
                    if (progress)
                        progress (++i / m);
                }
            }) (progress);

            xhr.onerror = (function (progress) {
                return function (e) {
                    shader.state = ShaderLoader.ERROR;
                    if (progress)
                        progress (++i / m);
                }
            }) (progress);

            xhr.open('GET', shader.file + '?' + ShaderLoader.noCache);
            xhr.send ();
        });
    }
}