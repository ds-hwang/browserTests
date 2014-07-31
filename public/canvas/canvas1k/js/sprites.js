/**
 * See LICENSE file.
 *
 * Sprites demo | 1000 images moving @60fps on javascript.
 */
(function() {
    var W           = window.innerWidth;
    var H           = window.innerHeight;
    var N           = 1000;

    var bgImage     = null;
    var spriteImage = null;
    var ctx         = null;

    function start() {
        bgImage = new Image();
        bgImage.onload = function () {
            spriteImage = new Image();
            spriteImage.onload = function() {
                prepareScene();
                drawScene();
            }
            spriteImage.src = "resources/images/asteroide.png";
        }
        bgImage.src = "resources/images/fondo.png";
    }

    function prepareScene() {
        // Create and draw the sprites canvas
        var canvas = document.createElement('canvas');
        canvas.width= W;
        canvas.height= H;

        document.body.appendChild(canvas);
        ctx = canvas.getContext("2d");
    }

    function drawScene() {
        ctx.drawImage(bgImage, 0, 0, W, H);

        var dx = 3, dy = 3;
//        console.time("drawScene");
        for(var i = 0; i < 1000; i++ ) {
            ctx.drawImage(spriteImage, dx, dy);
        }
//        console.timeEnd("drawScene");

        requestAnimationFrame(drawScene);
    }

    function drawSprite(i) {
        var spriteX = 50 * i + Math.random() * 25;
        var spriteY = 50 * i + Math.random() * 25;

    }

    window.addEventListener("load",start,false);

})();
