package com.myominaung.phonesecondshoppos.mobile;
import android.Manifest;
import android.bluetooth.*;
import android.content.*;
import android.os.*;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;
@CapacitorPlugin(name="BluetoothPrinter",permissions={
 @Permission(alias="modern",strings={Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT}),
 @Permission(alias="legacy",strings={Manifest.permission.ACCESS_FINE_LOCATION})})
public class BluetoothPrinterPlugin extends Plugin {
 private BluetoothAdapter adapter(){BluetoothManager m=(BluetoothManager)getContext().getSystemService(Context.BLUETOOTH_SERVICE);return m==null?null:m.getAdapter();}
 private String alias(){return Build.VERSION.SDK_INT>=31?"modern":"legacy";}
 private PluginCall scanning;private BroadcastReceiver receiver;private final Handler handler=new Handler(Looper.getMainLooper());
 private final Map<String,JSObject> devices=new java.util.concurrent.ConcurrentHashMap<>();
 @PluginMethod public void execute(PluginCall call){
  String action=call.getString("action","");
  if(!Arrays.asList("status","search","connect","disconnect","settings").contains(action)){call.reject("INVALID_INPUT");return;}
  if(action.equals("settings")){try{getActivity().startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));call.resolve();}catch(Exception e){call.reject("PRINTER_UNSUPPORTED");}return;}
  if(action.equals("disconnect")){BluetoothPrinter.disconnect();call.resolve(state());return;}
  if(action.equals("status")||adapter()==null){call.resolve(state());return;}
  if(getPermissionState(alias())!=PermissionState.GRANTED){requestPermissionForAlias(alias(),call,"permissionResult");return;}
  try{perform(call);}catch(SecurityException e){call.reject("PRINTER_PERMISSION");}catch(Exception e){call.reject("PRINTER_CONNECT_FAILED");}
 }
 @PermissionCallback private void permissionResult(PluginCall call){if(getPermissionState(alias())!=PermissionState.GRANTED){call.reject("PRINTER_PERMISSION");return;}try{perform(call);}catch(SecurityException e){call.reject("PRINTER_PERMISSION");}catch(Exception e){call.reject("PRINTER_CONNECT_FAILED");}}
 private JSObject state(){JSObject s=new JSObject();BluetoothAdapter a=adapter();s.put("supported",a!=null);s.put("permission",getPermissionState(alias())==PermissionState.GRANTED);boolean enabled=false;try{enabled=a!=null&&a.isEnabled();}catch(SecurityException ignored){}s.put("enabled",enabled);s.put("connected",BluetoothPrinter.connected());s.put("address",BluetoothPrinter.address);s.put("devices",new JSArray(new ArrayList<>(devices.values())));return s;}
 private void add(BluetoothDevice d){if(d==null||devices.size()>=50)return;JSObject v=new JSObject();v.put("address",d.getAddress());v.put("name",d.getName()==null?"Bluetooth device":d.getName());v.put("paired",d.getBondState()==BluetoothDevice.BOND_BONDED);devices.put(d.getAddress(),v);}
 private void finishScan(){PluginCall call=scanning;scanning=null;if(receiver!=null){try{getContext().unregisterReceiver(receiver);}catch(Exception ignored){}receiver=null;}try{if(adapter()!=null)adapter().cancelDiscovery();}catch(SecurityException ignored){}if(call!=null)call.resolve(state());}
 private void perform(PluginCall call){
  BluetoothAdapter a=adapter();if(a==null||!a.isEnabled()){call.reject("PRINTER_BLUETOOTH_OFF");return;}
  if(call.getString("action","").equals("connect")){
   String mac=call.getString("address","");if(!BluetoothAdapter.checkBluetoothAddress(mac)){call.reject("INVALID_INPUT");return;}
   if(scanning!=null){call.reject("BUSY");return;}
   BluetoothDevice d=a.getRemoteDevice(mac);if(d.getBondState()!=BluetoothDevice.BOND_BONDED){call.reject("PRINTER_PAIR_FIRST");return;}
   long epoch=BluetoothPrinter.epoch;BluetoothPrinter.worker.execute(()->{try{if(getPermissionState("modern")==PermissionState.GRANTED||Build.VERSION.SDK_INT<31)a.cancelDiscovery();BluetoothPrinter.connect(d,epoch);call.resolve(state());}catch(Exception e){call.reject("PRINTER_CONNECT_FAILED");}});return;
  }
  if(scanning!=null){call.reject("BUSY");return;}
  devices.clear();for(BluetoothDevice d:a.getBondedDevices())add(d);scanning=call;
  receiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent i){if(BluetoothDevice.ACTION_FOUND.equals(i.getAction())){try{add(i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE));}catch(SecurityException ignored){}}else if(BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(i.getAction()))finishScan();}};
  IntentFilter filter=new IntentFilter(BluetoothDevice.ACTION_FOUND);filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
  if(Build.VERSION.SDK_INT>=33)getContext().registerReceiver(receiver,filter,Context.RECEIVER_EXPORTED);else getContext().registerReceiver(receiver,filter);
  if(!a.startDiscovery()){finishScan();return;}handler.postDelayed(()->{if(scanning==call)finishScan();},12000);
 }
 @Override protected void handleOnDestroy(){finishScan();BluetoothPrinter.disconnect();super.handleOnDestroy();}
}
