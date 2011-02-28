package
{
  import flash.display.MovieClip;
  import flash.display.Sprite;
  import flash.events.ActivityEvent;
  import flash.events.Event;
  import flash.events.SampleDataEvent;
  import flash.events.StatusEvent;
  import flash.events.IEventDispatcher;  // not sure if we actually need this.
  import flash.external.ExternalInterface;
  import flash.media.Microphone;
  import flash.utils.ByteArray;
  import flash.text.TextField;

  [SWF(backgroundColor="0xaaaaaa")]

  public class AudioCapture extends MovieClip
  {
    private static const SR_AUDIO_ALLOWED:String = "SRAudioAllowed";
    public var _mic:Microphone;
    private var _container:Array = new Array();

    public function AudioCapture()
    {

      try
      {
        _mic = Microphone.getMicrophone();

        if (_mic != null) {
          _mic.gain = 60;
          _mic.rate = 22;
          _mic.setUseEchoSuppression(false);
          //_mic.setLoopBack(true);
          _mic.setSilenceLevel(0, 1000);
          _mic.addEventListener(StatusEvent.STATUS, onMicStatus);
          _mic.addEventListener(ActivityEvent.ACTIVITY, onMicActivity);
          ExternalInterface.addCallback("setMicRate", setMicRate);
          ExternalInterface.addCallback("startMicRecording", startMicRecording);
          ExternalInterface.addCallback("stopMicRecording", stopMicRecording);

        }
      }
      catch (e:Error)
      {
        trace("(caught error) AudioCapture.AudioCapture: " + e.toString() + " :\n.\n" + e.getStackTrace());
      }
    }


    private function setMicRate(samplerate:int):void
    {
      _mic.rate = 44; // int(samplerate/1000);
//      var rateText:String = String(_mic.rate);
//      textbox(rateText);
    }


    private function startMicRecording():void
    {
      _mic.addEventListener(SampleDataEvent.SAMPLE_DATA, onSampleData);
    }


    private function stopMicRecording():void
    {
      _mic.removeEventListener(SampleDataEvent.SAMPLE_DATA, onSampleData);
      if(ExternalInterface.available) {
          ExternalInterface.call("mic_stopped");
      }
    }


    public function textbox(mytext:String):void
    {
      // I've just been using this for debug, in place of trace.
      var display_txt:TextField = new TextField();
      display_txt.appendText(mytext);
      addChild(display_txt);
    }

    private function onMicActivity(event:ActivityEvent):void
    {
      trace(event.toString());
    }

    private function onMicStatus(event:StatusEvent):void
    {
      trace(event.toString());

      if (event.code == "Microphone.Unmuted")
      {
        trace("Microphone access was allowed.");
      }
      else if (event.code == "Microphone.Muted")
      {
        trace("Microphone access was denied.");
      }
    }

    private function onSampleData(event:SampleDataEvent):void
    {
      while(event.data.bytesAvailable) {

        // fetch the sample information and adjust
        var sample:Number = event.data.readFloat() * 65536;

        // add it to our container
        _container.push(sample);

        if(ExternalInterface.available) {

          // if we have enough samples, flush and start again
          // ## If this is is too short, Flash doesn't respond to the ##
          // ## stopMicRecording call from javascript. The more data ##
          // ## we collect in javascript, the longer this must be. ##
          if (_container.length >= 2048) {

            // send to js function
            ExternalInterface.call("audio_data", _container);

            // reset container
            _container.length = 0;
          }
        }
      }
    }
  }
}
