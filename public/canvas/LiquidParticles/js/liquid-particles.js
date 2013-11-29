/**
*   Liquid particles canvas experiment
*   ?2010 spielzeugz.de
*/

	var PI_2        = Math.PI * 2;

	var canvasW     = 480;
	var canvasH     = 600;
	var numMovers   = 600;
	var friction    = 0.96;
	var movers      = [];

	var canvas;
	var ctx;
	var canvasDiv;
	var outerDiv;

	var mouseX;
	var mouseY;
	var mouseVX;
	var mouseVY;
	var prevMouseX;
	var prevMouseY;
	var isMouseDown;

    var fps;
    var lastTime = new Date();
    var frameCount = 0;
    var fpsElement;
    var modeElement;
    var isShadowMode = false;
    var isStrokeMode = false;

    // shim layer with setTimeout fallback
    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame    ||
              window.oRequestAnimationFrame      ||
              window.msRequestAnimationFrame     ||
              function(/* function */ callback, /* DOMElement */ element){
                window.setTimeout(callback, 1000 / 60);
              };
    })();

	function init(){
		document.body.style.height = window.innerHeight + "px";
		document.body.style.width = window.innerWidth + "px";
		canvas = document.getElementById("mainCanvas");
		if ( canvas.getContext ){
			setup();
			animate();
		}
		else{
		}
	}

    function touchHandler(event){
        var touches = event.changedTouches,
            first = touches[0],
            type = "";
             switch(event.type)
        {
            case "touchstart": type = "mousedown"; break;
            case "touchmove":  type="mousemove"; break;
            case "touchend":   type="mouseup"; break;
            default: return;
        }

        var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(type, true, true, window, 1,
                                  first.screenX, first.screenY,
                                  first.clientX, first.clientY, false,
                                  false, false, false, 0/*left*/, null);
        first.target.dispatchEvent(simulatedEvent);
        event.preventDefault();
    }

	function setup(){
        areaDiv = document.getElementById("area");
		outerDiv  = document.getElementById("outer");
		canvasDiv = document.getElementById("canvasContainer");
		ctx       = canvas.getContext("2d");

		var i = numMovers;
		while ( i-- ){
			var m = new Mover();
			m.x   = canvasW * 0.5;
			m.y   = canvasH * 0.5;
			m.vX  = Math.cos(i) * Math.random() * 34;
			m.vY  = Math.sin(i) * Math.random() * 34;
			movers[i] = m;
		}

		mouseX = prevMouseX = canvasW * 0.5;
		mouseY = prevMouseY = canvasH * 0.5;

		document.onmousedown = onDocMouseDown;
		document.onmouseup   = onDocMouseUp;
		document.onmousemove = onDocMouseMove;

        canvas.addEventListener("touchstart", touchHandler, true);
        canvas.addEventListener("touchmove", touchHandler, true);
        canvas.addEventListener("touchend", touchHandler, true);
        canvas.addEventListener("touchcancel", touchHandler, true);

        fpsElement = document.getElementById("fps");
        modeElement = document.getElementById("mode");
        modeElement.innerHTML = getModeString();

        var element = document.getElementById("fillButton");
        element.addEventListener("click", setFillMode, false);
        element = document.getElementById("strokeButton");
        element.addEventListener("click", setStrokeMode, false);
        element = document.getElementById("shadowButton");
        element.addEventListener("click", toggleShadowMode, false);
	}

	function animate() {
        requestAnimFrame( animate );
//window.setTimeout(animate, 1);
        var nowTime = new Date();
        var diffTime = Math.ceil((nowTime.getTime() - lastTime.getTime()));
        if (diffTime >= 1000) {
            fps = frameCount;
            frameCount = 0.0;
            lastTime = nowTime;

            fpsElement.innerHTML = fps;
        }
		run();
        frameCount++;
	}

    function getModeString() {
        var str;
        str = numMovers + " particles / ";
        if (isStrokeMode)
            str += "Stroke";
        else
            str += "Fill";

        if (isShadowMode)
            str += " With Shadow";
        return str;
    }

	function run(){
		ctx.globalCompositeOperation = "source-over";
		ctx.fillStyle = "rgba(12,8,8,0.65)";

        ctx.shadowColor='rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

		ctx.fillRect( 0 , 0 , canvasW , canvasH );
		ctx.globalCompositeOperation = "lighter";
		ctx.globalAlpha = 1;

		mouseVX    = mouseX - prevMouseX;
		mouseVY    = mouseY - prevMouseY;
		prevMouseX = mouseX;
		prevMouseY = mouseY;

		var toDist   = canvasW * 0.86;
		var stirDist = canvasW * 0.125;
		var blowDist = canvasW * 0.5;

		var Mrnd = Math.random;
		var Mabs = Math.abs;

		var i = numMovers;
		while ( i-- ){
			var m  = movers[i];
			var x  = m.x;
			var y  = m.y;
			var vX = m.vX;
			var vY = m.vY;

			var dX = x - mouseX;
			var dY = y - mouseY;
			var d  = Math.sqrt( dX * dX + dY * dY ) || 0.001;
			dX /= d;
			dY /= d;

			if ( isMouseDown ){
				if ( d < blowDist ){
					var blowAcc = ( 1 - ( d / blowDist ) ) * 14;
					vX += dX * blowAcc + 0.5 - Mrnd();
					vY += dY * blowAcc + 0.5 - Mrnd();
				}
			}

			if ( d < toDist ){
				var toAcc = ( 1 - ( d / toDist ) ) * canvasW * 0.0014;
				vX -= dX * toAcc;
				vY -= dY * toAcc;
			}

			if ( d < stirDist ){
				var mAcc = ( 1 - ( d / stirDist ) ) * canvasW * 0.00026;
				vX += mouseVX * mAcc;
				vY += mouseVY * mAcc;
			}

			vX *= friction;
			vY *= friction;

			var avgVX = Mabs( vX );
			var avgVY = Mabs( vY );
			var avgV  = ( avgVX + avgVY ) * 0.5;

			if( avgVX < .1 ) vX *= Mrnd() * 3;
			if( avgVY < .1 ) vY *= Mrnd() * 3;

			var sc = avgV * 0.45;
			sc = Math.max( Math.min( sc , 3.5 ) , 0.4 ) + 1;

			var nextX = x + vX;
			var nextY = y + vY;

			if ( nextX > canvasW ){
				nextX = canvasW;
				vX *= -1;
			}
			else if ( nextX < 0 ){
				nextX = 0;
				vX *= -1;
			}

			if ( nextY > canvasH ){
				nextY = canvasH;
				vY *= -1;
			}
			else if ( nextY < 0 ){
				nextY = 0;
				vY *= -1;
			}

			m.vX = vX;
			m.vY = vY;
			m.x  = nextX;
			m.y  = nextY;

            if (isStrokeMode) {
                ctx.strokeStyle = m.color;
                ctx.lineWidth = 2;
            } else {
                ctx.fillStyle = m.color;
            }

			ctx.beginPath();
			ctx.arc( nextX , nextY , sc, 0 , PI_2 , true );
			ctx.closePath();

            if (isShadowMode) {
                ctx.shadowColor=m.color;
                ctx.shadowBlur = sc;
                ctx.shadowOffsetX = -sc/2;
                ctx.shadowOffsetY = -sc/2;
            }

            if (isStrokeMode)
                ctx.stroke();
            else
                ctx.fill();
		}
	}

	function onDocMouseMove( e ){
		var ev = e ? e : window.event;
		mouseX = ev.clientX - areaDiv.offsetLeft - outerDiv.offsetLeft - canvasDiv.offsetLeft;
		mouseY = ev.clientY - areaDiv.offsetTop - outerDiv.offsetTop  - canvasDiv.offsetTop;
	}

	function onDocMouseDown( e ){
		isMouseDown = true;
		return false;
	}

	function onDocMouseUp( e ){
		isMouseDown = false;
		return false;
	}

	function Mover(){
		this.color = "rgb(" + Math.floor( Math.random()*255 ) + "," + Math.floor( Math.random()*255 ) + "," + Math.floor( Math.random()*255 ) + ")";
		this.y     = 0;
		this.x     = 0;
		this.vX    = 0;
		this.vY    = 0;
		this.size  = 1;
	}


	function rect( context , x , y , w , h ){
		context.beginPath();
		context.rect( x , y , w , h );
		context.closePath();
		context.fill();
	}

    function setFillMode() {
        isStrokeMode = false;
        modeElement.innerHTML = getModeString();
    }

    function setStrokeMode() {
        isStrokeMode = true;
        modeElement.innerHTML = getModeString();
    }

    function toggleShadowMode() {
        isShadowMode = !isShadowMode;
        modeElement.innerHTML = getModeString();
    }

	window.onload = init;
