package com.myominaung.phonesecondshoppos.mobile;

import android.app.Activity;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.os.Bundle;
import android.print.*;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import androidx.core.content.FileProvider;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/** Bundled, script-disabled receipt rendering. JPEG export is explicit and never auto-shared. */
public class ReceiptActivity extends Activity {
 private WebView view;
 private boolean loaded=false,busy=false;
 private final List<Button> actions=new ArrayList<>();
 private final ExecutorService images=Executors.newSingleThreadExecutor();
 private String l(String en,String my,String th){String language=getIntent().getStringExtra("language");return "en-US".equals(language)?en:"th-TH".equals(language)?th:my;}
 private String paper(){return getIntent().getStringExtra("paper");}
 private Button action(String title,LinearLayout row,Runnable handler){Button b=new Button(this);b.setText(title);b.setEnabled(false);b.setOnClickListener(v->handler.run());row.addView(b,new LinearLayout.LayoutParams(0,-2,1));actions.add(b);return b;}
 private LinearLayout row(LinearLayout root){LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);root.addView(row);return row;}
 private void ready(boolean value){busy=!value;for(int i=0;i<actions.size();i++)actions.get(i).setEnabled(value&&loaded&&(i!=1||!"A4".equals(paper())));}
 private void message(String text){if(!isDestroyed())Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);setTitle(l("Receipt","ပြေစာ","ใบเสร็จ"));
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  LinearLayout printing=row(root);
  action(l("Print / PDF","ပုံနှိပ် / PDF","พิมพ์ / PDF"),printing,()->printReceipt());
  action(l("Bluetooth print","Bluetooth ပုံနှိပ်","พิมพ์บลูทูธ"),printing,()->printBluetooth());
  LinearLayout exporting=row(root);
  action(l("Save JPEG","JPEG သိမ်းရန်","บันทึก JPEG"),exporting,()->exportImage(false));
  action(l("Share JPEG","JPEG မျှဝေရန်","แชร์ JPEG"),exporting,()->exportImage(true));
  Button close=new Button(this);close.setText(l("Close","ပိတ်","ปิด"));close.setOnClickListener(v->finish());root.addView(close);
  view=new WebView(this);view.getSettings().setJavaScriptEnabled(false);view.getSettings().setAllowFileAccess(false);view.getSettings().setAllowContentAccess(false);view.getSettings().setSupportZoom(true);view.getSettings().setBuiltInZoomControls(true);view.getSettings().setDisplayZoomControls(false);
  view.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return true;}
   @Override public void onPageFinished(WebView v,String url){loaded=true;if(!busy)ready(true);if(!getIntent().getBooleanExtra("preview",true))printReceipt();}
  });
  root.addView(view,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
  ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});
  try{String html=new String(Files.readAllBytes(new File(getCacheDir(),"receipt.html").toPath()),StandardCharsets.UTF_8);view.loadDataWithBaseURL("file:///android_asset/public/",html,"text/html","UTF-8",null);}catch(Exception e){message(l("Could not open receipt","ပြေစာဖွင့်မရပါ","เปิดใบเสร็จไม่สำเร็จ"));finish();}
 }
 private void restoreView(int width,int layer,int x,int y){if(isDestroyed())return;android.view.ViewGroup.LayoutParams p=view.getLayoutParams();p.width=width;view.setLayoutParams(p);view.setLayerType(layer,null);view.getSettings().setSupportZoom(true);view.post(()->{if(!isDestroyed())view.scrollTo(x,y);});}
 private void capture(int dots,int limitHeight,Consumer<Bitmap> done){
  if(!loaded||busy)return;ready(false);
  int oldWidth=view.getLayoutParams().width,oldLayer=view.getLayerType(),oldX=view.getScrollX(),oldY=view.getScrollY();
  int cssWidth="A4".equals(paper())?760:"58mm".equals(paper())?200:280;
  int rawWidth=Math.round(cssWidth*getResources().getDisplayMetrics().density);
  view.getSettings().setSupportZoom(true);view.zoomBy(getResources().getDisplayMetrics().density/view.getScale());view.getSettings().setSupportZoom(false);view.setLayerType(View.LAYER_TYPE_SOFTWARE,null);
  android.view.ViewGroup.LayoutParams params=view.getLayoutParams();params.width=rawWidth;view.setLayoutParams(params);
  view.measure(View.MeasureSpec.makeMeasureSpec(rawWidth,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(Math.max(1,view.getHeight()),View.MeasureSpec.EXACTLY));view.layout(0,0,rawWidth,Math.max(1,view.getHeight()));
  view.postDelayed(()->{if(isFinishing()||isDestroyed())return;view.postVisualStateCallback(1,new WebView.VisualStateCallback(){@Override public void onComplete(long id){
   if(isFinishing()||isDestroyed())return;
   Bitmap bitmap=null;
   try{
    int rawHeight=(int)Math.ceil(view.getContentHeight()*view.getScale());int height=(int)Math.ceil(rawHeight*(double)dots/rawWidth);
    if(height<1||height>limitHeight||(long)dots*height>12_000_000)throw new IllegalArgumentException();
    bitmap=Bitmap.createBitmap(dots,height,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.WHITE);canvas.scale((float)dots/rawWidth,(float)dots/rawWidth);view.scrollTo(0,0);view.draw(canvas);
    restoreView(oldWidth,oldLayer,oldX,oldY);done.accept(bitmap);
   }catch(RuntimeException|OutOfMemoryError e){if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();restoreView(oldWidth,oldLayer,oldX,oldY);ready(true);message(l("Receipt too large · Use Print / PDF","ပြေစာရှည်လွန်းသည် · ပုံနှိပ် / PDF ကိုသုံးပါ","ใบเสร็จยาวเกินไป ใช้พิมพ์ / PDF"));}
  }});},900);
 }
 private void printBluetooth(){
  if(!BluetoothPrinter.connected()){message(l("Connect a Classic ESC/POS printer in Owner settings first","ပိုင်ရှင်ဆက်တင်တွင် Classic ESC/POS ပရင်တာကို အရင်ချိတ်ပါ","เชื่อมต่อเครื่องพิมพ์ Classic ESC/POS ในการตั้งค่าก่อน"));return;}
  capture("58mm".equals(paper())?384:576,8000,bitmap->BluetoothPrinter.worker.execute(()->{
   String text;try{BluetoothPrinter.print(bitmap);text=l("Sent to printer · Check paper output","ပရင်တာသို့ပို့ပြီး · စာရွက်ထွက်မှု စစ်ဆေးပါ","ส่งแล้ว ตรวจสอบกระดาษที่พิมพ์");}catch(Exception e){text=l("Print failed or partial · Check printer before retrying","ပုံနှိပ်မအောင်မြင် သို့မဟုတ် တစ်စိတ်တစ်ပိုင်းသာထွက်သည် · ပရင်တာကိုစစ်ပါ","พิมพ์ไม่สำเร็จหรือพิมพ์บางส่วน ตรวจสอบก่อนลองใหม่");}finally{bitmap.recycle();}
   final String result=text;runOnUiThread(()->{if(!isDestroyed()){ready(true);message(result);}});
  }));
 }
 private void exportImage(boolean share){
  int dots="A4".equals(paper())?1440:"58mm".equals(paper())?720:1080;
  capture(dots,16000,bitmap->images.execute(()->{
   Uri saved=null;
   try{
    String name="FixerTools-Receipt-"+System.currentTimeMillis()+"-"+UUID.randomUUID().toString().substring(0,8)+".jpg";
    if(share){
     File dir=new File(getCacheDir(),"receipt-images");if(!dir.exists()&&!dir.mkdirs())throw new IOException();
     File[] old=dir.listFiles();if(old!=null)for(File f:old)if(f.isFile()&&f.getName().startsWith("FixerTools-Receipt-")&&f.lastModified()<System.currentTimeMillis()-86_400_000L)f.delete();
     File image=new File(dir,name);try(OutputStream out=new FileOutputStream(image)){if(!bitmap.compress(Bitmap.CompressFormat.JPEG,92,out))throw new IOException();}
     Uri uri=FileProvider.getUriForFile(this,getPackageName()+".fileprovider",image);
     runOnUiThread(()->{if(!isFinishing()&&!isDestroyed()){
      try{Intent intent=new Intent(Intent.ACTION_SEND);intent.setType("image/jpeg");intent.putExtra(Intent.EXTRA_STREAM,uri);intent.setClipData(ClipData.newRawUri(l("Receipt JPEG","ပြေစာ JPEG","ใบเสร็จ JPEG"),uri));intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(intent,l("Share receipt JPEG","ပြေစာ JPEG မျှဝေရန်","แชร์ใบเสร็จ JPEG")));}catch(Exception e){message(l("No share app available","မျှဝေရန် app မရှိပါ","ไม่มีแอปสำหรับแชร์"));}finally{ready(true);}
     }});
    }else{
     ContentResolver resolver=getContentResolver();ContentValues values=new ContentValues();values.put(MediaStore.Images.Media.DISPLAY_NAME,name);values.put(MediaStore.Images.Media.MIME_TYPE,"image/jpeg");values.put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/FixerTools");values.put(MediaStore.Images.Media.IS_PENDING,1);
     saved=resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);if(saved==null)throw new IOException();
     try(OutputStream out=resolver.openOutputStream(saved,"w")){if(out==null||!bitmap.compress(Bitmap.CompressFormat.JPEG,92,out))throw new IOException();}
     ContentValues complete=new ContentValues();complete.put(MediaStore.Images.Media.IS_PENDING,0);if(resolver.update(saved,complete,null,null)!=1)throw new IOException();
     runOnUiThread(()->{if(!isDestroyed()){ready(true);message(l("Saved JPEG · Pictures/FixerTools","JPEG သိမ်းပြီးပါပြီ · Pictures/FixerTools","บันทึก JPEG แล้ว · Pictures/FixerTools"));}});
    }
   }catch(Exception e){if(saved!=null)try{getContentResolver().delete(saved,null,null);}catch(Exception ignored){}runOnUiThread(()->{if(!isDestroyed()){ready(true);message(l("Could not save/share JPEG · Check free storage","JPEG သိမ်း/မျှဝေမရပါ · နေရာလွတ်စစ်ပါ","บันทึก/แชร์ JPEG ไม่สำเร็จ ตรวจสอบพื้นที่ว่าง"));}});}finally{bitmap.recycle();}
  }));
 }
 private void printReceipt(){if(!loaded||busy)return;PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);PrintAttributes.MediaSize media=PrintAttributes.MediaSize.ISO_A4;if("58mm".equals(paper())||"80mm".equals(paper())){int width="58mm".equals(paper())?2283:3150;media=new PrintAttributes.MediaSize("POS",paper(),width,9843);}manager.print(("Fixer Tools · "+l("Receipt","ပြေစာ","ใบเสร็จ")),view.createPrintDocumentAdapter(("Fixer Tools · "+l("Receipt","ပြေစာ","ใบเสร็จ"))),new PrintAttributes.Builder().setMediaSize(media).setMinMargins(PrintAttributes.Margins.NO_MARGINS).build());}
 @Override protected void onDestroy(){images.shutdown();if(view!=null){view.destroy();view=null;}super.onDestroy();}
}
