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
var Boat = function (meshFile, complete) {
    var that = this,
        mass = 10000, /* Kg */
        rudder_distance = 5; /* meters */

    var MAX_SPEED = 10;
    
    var commands = {
        STOP: 0,
        FORWARD: 1,
        LEFT: 2,
        RIGHT: 3,
        LAST_COMMAND: 4
    };
    
    var key_left = false, key_right = false, key_forward = false;

    var auto_drive = {
        enabled: true,
        command: commands.STOP,
        start_time: Date.now (),
        stop_time: 500 + Date.now () + Math.random () * 5
    };
    
    this.x = this.y = this.a = 0;
    this.N = new THREE.Vector2 (); /* Normal vector of movement */
    this.maxSpeed = MAX_SPEED;
    
    var K = 0, /* Kinetic energy */
        t = 0, /* torque */
        u = 0.02, /* co-efficient of friction of water / hull */
        F = 0; /* Force being applied to add energy to the boat */
    
    this.V = 0; /* Velocity */
    this.N.x = 0;
    this.N.y = 1;
    
    this.mesh = new THREE.Mesh(
        new THREE.CubeGeometry (48, 11, 25),
        new THREE.MeshPhongMaterial ({ color: 0xff00ff })
    );
    this.mesh.geometry.computeBoundingSphere();
    this.loader = new THREE.JSONLoader();
    
    this.loader.load('assets/models/' + meshFile, function (geometry, materials) {
        var faceMaterial = new THREE.MeshFaceMaterial(materials);
        faceMaterial.materials.forEach(function(material) {
            material.side = THREE.DoubleSide;
        });
        that.mesh = new THREE.Mesh(geometry, faceMaterial);
        that.mesh.quaternion.setFromAxisAngle (
            new THREE.Vector3(1, 0, 0), Math.PI * 0.5);
        that.mesh.rotation.y = Math.PI;
        that.mesh.geometry.computeBoundingSphere();
        that.mesh.position.z = -1; /* 1 meters below surface */
        
        if (complete) {
            complete.call(that);
        }
    });

    this.applyAI = function() {
        if (auto_drive.enabled) {
            key_left = key_right = key_forward = false;
            if (Date.now () > auto_drive.stop_time) {
                var last_command = auto_drive.command;
                while (last_command == auto_drive.command) {
                    auto_drive.command = Math.floor (Math.random () * commands.LAST_COMMAND);
                    /* Decrease odds of STOP command */
                    if (auto_drive.command == commands.STOP)
                        auto_drive.command = Math.floor (Math.random () * commands.LAST_COMMAND);
                }
                auto_drive.start_time = Date.now ();
            }
    
            switch (auto_drive.command) {
            case commands.STOP:
                auto_drive.stop_time = auto_drive.start_time + 500 + Math.random () * 500;
                break;
            case commands.FORWARD:
                key_forward = true;
                auto_drive.stop_time = auto_drive.start_time + 2000 + Math.random () * 2000;
                break;
            case commands.LEFT:
                key_left = true;
                key_forward = true;
                auto_drive.stop_time = auto_drive.start_time + 500 + Math.random () * 4000;
                break;
            case commands.RIGHT:
                key_right = true;
                key_forward = true;
                auto_drive.stop_time = auto_drive.start_time + 500 + Math.random () * 4000;
                break;
            }
            
            if (key_left) {
                that.applyTorque(+5000000);
            }
            if (key_right) {
                that.applyTorque(-5000000);
            }
            if (key_forward) {
                that.applyForce(45000);
            } else {
                that.applyForce(-10000);
            }
        }        
    }
    
    this.applyTime = function (time) {
        that.V += (F / mass) * time / 1000;
        K = 0.5 * mass * that.V * that.V;
        K += -u * 9.8 * time / 1000; /* Decrease energy by friction */
        if (K < 0)
            K = 0;
            
        /* F = m * a */
        /* K = 0.5 * m * v^2 */
        /* v = v + a * t;

        /* If there is any torque being applied, use the boat's
         * kinetic energy to perform the rotation */
        if (t && K > 0) {
            /* torque = radius * force */
            var Fr = t / rudder_distance, /* Rotational force */
                Ar = Fr / mass, /* Rotational acceleration */
                Vr = Ar * time / 1000; /* Rotational speed */
            Kr = 0.5 * mass * Vr * Vr; /* Rotational energy */
            if (Kr * (u * time / 1000) > K) { 
                /* Not enough forward movement to translate to 
                 * rotational energy */
                Kr = K / (u * time / 1000);
                K = 0;
                Vr = ((t > 0) ? +1 : -1) * Math.sqrt (Kr * 2 / mass);
            } else {
                K -= (u * time / 1000) * Kr;
            }
            that.a += Vr * time / 1000;
            while (that.a > 2 * Math.PI)
                that.a -= 2 * Math.PI;
            while (that.a < 2 * -Math.PI)
                that.a += 2 * Math.PI;
        }

        that.V = Math.sqrt (K * 2 / mass);
        if (that.V > that.maxSpeed) { /* Max at 10m/s */
            that.V = that.maxSpeed;
            K = 0.5 * mass * that.maxSpeed * that.maxSpeed; /* 0.5 * mass * v^2 */
        }

        that.N.x = Math.sin (that.a);
        that.N.y = Math.cos (that.a);
        
        that.x -= that.N.x * that.V * time / 1000;
        that.y += that.N.y * that.V * time / 1000;

        /* Reset Force and Torque */
        t = F = 0;
    }
    
    this.applyTorque = function (torque) {
        t = torque;
    }
    
    this.applyForce = function (force) { /* Newtons per second */
        F = force;
    }
    
    this.getPosition = function () {
        return new THREE.Vector3 (that.x, that.y, 0);
    }

    return this;
}
    
Boat.prototype = {
    constructor: Boat
};
