function AudioSync() {

  var audio = [];
  var fplength = 0;
  var counter = 0;

  this.config = null;
  this.config_url = '/api/config.json';
  this.fingerprint_url = '/query';
  this.audio_swf = null;
  this.audio_swf_callback = null;
  this.logging = false;

  this.log = function(msg)
  {
    if (this.logging && window.console) {console.log(msg);}
  }

  this.getConfig = function(callback)
  {
    var obj = this;
    if (obj.config != undefined) {
      obj.log("Config aleady loaded");
      return callback.call(obj);
    }

    $.getJSON(this.config_url, function(data) {
      obj.log("Config recieved");
      fplength =  data.recduration * data.samplerate;
      obj.config = data;

      if (callback != undefined) callback.call(obj);
    });
  };

  this.progress = function() {
    return counter;
  }

  this.startFlashMicRecorder = function()
  {
    if (!this.audio_swf) return;
    if (!this.config) {
      this.getConfig(arguments.callee);
      return;
    };

    this.buffer_full = false;
    this.audio_swf.setCallBackObject('as');
    this.audio_swf.setMicRate(this.config.samplerate);
    this.audio_swf.startMicRecording();
  }

  this.stopFlashMicRecorder = function()
  {
    if (!this.audio_swf) return;
    this.audio_swf.stopMicRecording();
  }

  this.micStopped = function() {
    if (this.onMicStopped != undefined) this.onMicStopped();
    this.postFingerPrint();
  }

  this.micStarted = function() {
    if (this.onMicStarted != undefined) this.onMicStarted();
  }

  this.statusEvent = function(e) {
    if (this.onStatusEvent != undefined) this.onStatusEvent(e);
  }

  this.micActivity = function() {
    if (this.micActivity != undefined) this.onMicActivity();
  }

  this.onAudioData = function(sample)
  {
    if (!this.buffer_full) {
      if ( audio && audio.length < fplength ) {
        audio = audio.concat(sample);
        this.counter = (audio.length / fplength);
      } else {
        this.buffer_full = true;
        this.stopFlashMicRecorder();
      }
    }
  }

  this.postFingerPrint = function()
  {
    var fp = this.generateFingerprint();
    var obj = this;

    if (this.onFingerPrintPost != undefined) this.onFingerPrintPost();

    $.post(this.fingerprint_url, this.formQueryString(fp),
      function(data) {
        if ("error" in data) {
          if (obj.onMatchError != undefined) obj.onMatchError(data);
          obj.log(data.errorstring);
        } else if ( data.service != undefined ) {
          if (obj.onMatchFound != undefined) obj.onMatchFound(data);
          obj.log("Match found to " + data.service +
                  " at time " + data.time + ".");
        } else {
          if (obj.onMatchNotFound != undefined) obj.onMatchNotFound(data);
          obj.log("Sorry, no match found. Please try again.");
        }
      }, "json");
  }

  this.generateFingerprint = function()
  {
    var fftsize = Number(this.config.fftsize);
    var fftoffset = Number(this.config.fftoffset);

    // Not sure what the division does to fftsize, but dsp.js won't work without it.
    // Obviously it's a type casting thing, but i can't find the right type
    // to set it to manually. Float doesn't work.
    var fft = new FFT(fftsize/1, Number(this.config.samplerate));

    // Iterate over the audio sample passing chunks to the fingerprinter
    // and stacking the returned values onto an array
    var fingerprint = [];
    for ( var n=0; n < audio.length - fftsize; n+=fftoffset ) {
      var chunk = audio.slice(n, n+fftsize);
      fingerprint.push(this.fingerprintInBands(chunk, fft));
    }

    return fingerprint;
  }

  this.fingerprintInBands = function(audioChunk, fft)
  {
    fft.forward(audioChunk);
    var spectrum = fft.spectrum;
    var banddivs = this.config.banddivs;
    var domFreqs = [];

    // The 2nd half of the array is imaginary (so undefined)
    spectrum.length = spectrum.length/2;

    // For each band, find the dominant frequency bin, then return an
    // array of these - one element for each band.
    // Float32Array.slice in Chrome, but Float32Array.subarray in FF4b11
    for (var n=1; n < banddivs.length; n++) {
      // check for ff4
      if (spectrum.subarray) {
        domFreqs.push(this.arryMax(spectrum.subarray(banddivs[n-1], banddivs[n])));
      } else {
        domFreqs.push(this.arryMax(spectrum.slice(banddivs[n-1], banddivs[n])));
      }
    }

    return domFreqs;
  }

// test code...
var getKeys = function(obj){
   var keys = [];
   for(var key in obj){
      keys.push(key);
   }
   return keys;
}


  this.formQueryString = function(fingerprint)
  {
    // This part really just transposes the 'array'.
    var fpdict = [];
    var band_size = fingerprint[0].length;
    var fingerprint_len = fingerprint.length;

    // Iterate over the bands
    for (var i=0; i < band_size; i++) {

      // Create a string in ftdict for each band
      fpdict[i] = new Array(fingerprint_len);

      // Iterate over each fingerprint point for each band
      for (var n=0; n < fingerprint_len; n++) {
        fpdict[i][n] = fingerprint[n][i];
      }
    }

    // Concatonate into query string for HTTP POST
    return "fingerprint=" + JSON.stringify(fpdict);
  }

  this.arryMax = function( array )
  {
    //return Math.max.apply( Math, array );
    var argmax = 0

    for ( var i=0; i < array.length; i++) {
      if (array[i] > array[argmax]) argmax = i;
    }

    return argmax;
  }

}
