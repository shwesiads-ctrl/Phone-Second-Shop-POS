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
  if(android.os.Build.VERSION.SDK_INT>=35){
   android.view.View content=findViewById(android.R.id.content);
   content.setBackgroundColor(android.graphics.Color.rgb(16,24,35));
   androidx.core.view.WindowInsetsControllerCompat bars=new androidx.core.view.WindowInsetsControllerCompat(getWindow(),content);
   bars.setAppearanceLightStatusBars(false);bars.setAppearanceLightNavigationBars(false);
   androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(content,(view,insets)->{
    androidx.core.graphics.Insets safe=insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars()|androidx.core.view.WindowInsetsCompat.Type.displayCutout());
    view.setPadding(safe.left,safe.top,safe.right,safe.bottom);return insets;
   });
   androidx.core.view.ViewCompat.requestApplyInsets(content);
  }
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){
   if(exitDialog!=null&&exitDialog.isShowing())return;
   try{getBridge().getWebView().evaluateJavascript("(()=>{const dialog=document.querySelector('dialog[open]');if(dialog){const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close();return true;}if(document.querySelector('aside.mobile-drawer.is-open')){window.dispatchEvent(new Event('fixer-close-menu'));return true;}return false;})()",result->{if(!"true".equals(result))confirmExit();});}catch(Exception e){confirmExit();}
  }});
 }
}
