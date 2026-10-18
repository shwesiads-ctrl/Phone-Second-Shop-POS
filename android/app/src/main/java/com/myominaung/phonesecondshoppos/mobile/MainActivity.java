package com.myominaung.phonesecondshoppos.mobile;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import android.app.AlertDialog;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 private AlertDialog exitDialog;
 @Override public void onCreate(Bundle state) {
  android.webkit.WebView.enableSlowWholeDocumentDraw();
  registerPlugin(PosNativePlugin.class);registerPlugin(BluetoothPrinterPlugin.class);super.onCreate(state);
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){
   if(exitDialog!=null&&exitDialog.isShowing())return;
   exitDialog=new AlertDialog.Builder(MainActivity.this).setTitle("Exit POS? · ထွက်မလား · ออกจากแอป?")
    .setMessage("Unsaved forms/cart are not saved automatically. Hold the cart or save your work first.\nမသိမ်းရသေးသောအချက်အလက်များ ပျောက်နိုင်ပါသည်။\nบันทึกงานหรือพักตะกร้าก่อนออก")
    .setNegativeButton("Stay · မထွက်ပါ · อยู่ต่อ",(d,w)->d.dismiss())
    .setPositiveButton("Exit · ထွက်မည် · ออก",(d,w)->{BluetoothPrinter.disconnect();finishAndRemoveTask();}).create();exitDialog.show();
  }});
 }
}
