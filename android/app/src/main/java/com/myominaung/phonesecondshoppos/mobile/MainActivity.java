package com.myominaung.phonesecondshoppos.mobile;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import android.app.AlertDialog;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 private AlertDialog exitDialog;
 private void confirmExit(){
  if(isFinishing()||isDestroyed()||(exitDialog!=null&&exitDialog.isShowing()))return;
  exitDialog=new AlertDialog.Builder(this).setTitle("Exit Fixer Tools? · ထွက်မလား · ออกจากแอป?")
   .setMessage("Unsaved forms/cart are not saved automatically. Hold the cart or save your work first.\nမသိမ်းရသေးသောအချက်အလက်များ ပျောက်နိုင်ပါသည်။\nบันทึกงานหรือพักตะกร้าก่อนออก")
   .setNegativeButton("Stay · မထွက်ပါ · อยู่ต่อ",(d,w)->d.dismiss())
   .setPositiveButton("Exit · ထွက်မည် · ออก",(d,w)->{BluetoothPrinter.disconnect();finishAndRemoveTask();}).create();exitDialog.show();
 }
 @Override public void onCreate(Bundle state){
  android.webkit.WebView.enableSlowWholeDocumentDraw();registerPlugin(PosNativePlugin.class);registerPlugin(BluetoothPrinterPlugin.class);super.onCreate(state);
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){
   if(exitDialog!=null&&exitDialog.isShowing())return;
   try{getBridge().getWebView().evaluateJavascript("(()=>{const dialog=document.querySelector('dialog[open]');if(dialog){const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close();return true;}if(document.querySelector('aside.mobile-drawer.is-open')){window.dispatchEvent(new Event('fixer-close-menu'));return true;}return false;})()",result->{if(!"true".equals(result))confirmExit();});}catch(Exception e){confirmExit();}
  }});
 }
}
