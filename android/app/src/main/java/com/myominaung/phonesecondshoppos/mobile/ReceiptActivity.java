package com.myominaung.phonesecondshoppos.mobile;
import android.app.Activity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.widget.Button;
import android.widget.LinearLayout;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** A separate script-disabled preview; printing uses Android's system print service. */
public class ReceiptActivity extends Activity {
 private WebView view;private boolean loaded=false;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);Button print=new Button(this);print.setText("Print / PDF · ပုံနှိပ် · พิมพ์");print.setEnabled(false);layout.addView(print);Button close=new Button(this);close.setText("Close · ပိတ် · ปิด");close.setOnClickListener(v->finish());layout.addView(close);
  view=new WebView(this);view.getSettings().setJavaScriptEnabled(false);view.getSettings().setAllowFileAccess(false);view.getSettings().setAllowContentAccess(false);view.getSettings().setSupportZoom(true);view.getSettings().setBuiltInZoomControls(true);view.getSettings().setDisplayZoomControls(false);view.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return true;}@Override public void onPageFinished(WebView v,String url){loaded=true;print.setEnabled(true);if(!getIntent().getBooleanExtra("preview",true))printReceipt();}});layout.addView(view,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);ViewCompat.setOnApplyWindowInsetsListener(layout,(v,insets)->{Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});print.setOnClickListener(v->printReceipt());
  try {String html=new String(Files.readAllBytes(new File(getCacheDir(),"receipt.html").toPath()),StandardCharsets.UTF_8);view.loadDataWithBaseURL("file:///android_asset/public/",html,"text/html","UTF-8",null);}catch(Exception e){finish();}
 }
 private void printReceipt(){if(!loaded)return;PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);String paper=getIntent().getStringExtra("paper");PrintAttributes.MediaSize media=PrintAttributes.MediaSize.ISO_A4;if("58mm".equals(paper)||"80mm".equals(paper)){int width="58mm".equals(paper)?2283:3150;media=new PrintAttributes.MediaSize("POS",paper,width,9843);}manager.print("POS Receipt",view.createPrintDocumentAdapter("POS Receipt"),new PrintAttributes.Builder().setMediaSize(media).setMinMargins(PrintAttributes.Margins.NO_MARGINS).build());}
 @Override protected void onDestroy(){if(view!=null){view.destroy();view=null;}super.onDestroy();}
}
