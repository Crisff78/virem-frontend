const zego = require('zego-express-engine-webrtc');
console.log('Zego exports:', Object.keys(zego));
if (zego.ZegoExpressEngine) {
    console.log('ZegoExpressEngine is available');
} else {
    console.log('ZegoExpressEngine is NOT available directly');
}
