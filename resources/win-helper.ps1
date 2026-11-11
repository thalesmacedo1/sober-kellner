# Long-lived helper for Windows system control.
# Protocol: one JSON request per line on stdin  -> {"id":1,"cmd":"volume.get","args":{}}
#           one JSON response per line on stdout -> {"id":1,"ok":true,"result":{...}}
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace Kellner {
  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int f(); int g(); int h(); int i();
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int j();
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int k(); int l(); int m(); int n();
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
    int GetMute(out bool pbMute);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
  }

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int f();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorComObject { }

  public static class Audio {
    static IAudioEndpointVolume Endpoint() {
      var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
      IMMDevice device;
      Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out device));
      IAudioEndpointVolume volume;
      var iid = typeof(IAudioEndpointVolume).GUID;
      Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23 /* CLSCTX_ALL */, 0, out volume));
      return volume;
    }
    public static int GetVolume() {
      float v; Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out v));
      return (int)Math.Round(v * 100);
    }
    public static void SetVolume(int level) {
      float v = Math.Max(0, Math.Min(100, level)) / 100f;
      Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(v, Guid.Empty));
    }
    public static bool GetMute() {
      bool m; Marshal.ThrowExceptionForHR(Endpoint().GetMute(out m)); return m;
    }
    public static void SetMute(bool muted) {
      Marshal.ThrowExceptionForHR(Endpoint().SetMute(muted, Guid.Empty));
    }
  }

  public static class Input {
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] static extern bool LockWorkStation();
    const uint EXTENDED = 0x1, KEYUP = 0x2;
    public static void Tap(byte vk) {
      keybd_event(vk, 0, EXTENDED, UIntPtr.Zero);
      keybd_event(vk, 0, EXTENDED | KEYUP, UIntPtr.Zero);
    }
    public static bool Lock() { return LockWorkStation(); }
  }
}
'@

function Send-Response($id, $ok, $result) {
  $json = @{ id = $id; ok = $ok; result = $result } | ConvertTo-Json -Compress -Depth 5
  [Console]::Out.WriteLine($json)
  [Console]::Out.Flush()
}

function Get-VolumeState { @{ level = [Kellner.Audio]::GetVolume(); muted = [Kellner.Audio]::GetMute() } }

[Console]::Out.WriteLine('{"ready":true}')
[Console]::Out.Flush()

while ($null -ne ($line = [Console]::In.ReadLine())) {
  if (-not $line.Trim()) { continue }
  $id = $null
  try {
    $req = $line | ConvertFrom-Json
    $id = $req.id
    $a = $req.args
    $result = $null
    switch ($req.cmd) {
      'volume.get' { $result = Get-VolumeState }
      'volume.set' { [Kellner.Audio]::SetVolume([int]$a.level); $result = Get-VolumeState }
      'volume.mute' { [Kellner.Audio]::SetMute([bool]$a.muted); $result = Get-VolumeState }
      'key' { [Kellner.Input]::Tap([byte]$a.vk) }
      'lock' { $result = [Kellner.Input]::Lock() }
      'apps' { $result = @(Get-StartApps | ForEach-Object { @{ name = $_.Name; id = $_.AppID } }) }
      default { throw "unknown command: $($req.cmd)" }
    }
    Send-Response $id $true $result
  } catch {
    Send-Response $id $false "$_"
  }
}
