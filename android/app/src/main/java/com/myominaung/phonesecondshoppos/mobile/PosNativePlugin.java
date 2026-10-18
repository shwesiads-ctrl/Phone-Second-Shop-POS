package com.myominaung.phonesecondshoppos.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.net.Uri;
import android.os.Build;
import android.util.AtomicFile;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Only fixed private app storage and user-selected Android document URIs. */
@CapacitorPlugin(name="PosNative")
public class PosNativePlugin extends Plugin {
 private static final int LIMIT=32*1024*1024;
 private AtomicFile store() {return new AtomicFile(new File(getContext().getFilesDir(),"business.sqlite"));}
 private byte[] read(InputStream input,int limit) throws IOException {
  try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()) {byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("File exceeds supported size");out.write(b,0,n);}return out.toByteArray();}
 }
 @PluginMethod public void load(PluginCall call) {
  try {AtomicFile f=store();JSObject out=new JSObject();try {out.put("data",Base64.encodeToString(read(f.openRead(),LIMIT),Base64.NO_WRAP));} catch(FileNotFoundException missing) {String path=f.getBaseFile().getPath();if(f.getBaseFile().exists()||new File(path+".bak").exists()||new File(path+".new").exists())throw missing;}call.resolve(out);}catch(Exception e){call.reject("Could not read private database");}
 }
 @PluginMethod public void save(PluginCall call) {
  FileOutputStream stream=null;AtomicFile f=store();
  try {String data=call.getString("data","");if(data.length()>LIMIT*4L/3+8)throw new IOException();byte[] bytes=Base64.decode(data,Base64.DEFAULT);if(bytes.length>LIMIT||bytes.length<16||!new String(bytes,0,16,StandardCharsets.US_ASCII).equals("SQLite format 3\0"))throw new IOException();stream=f.startWrite();stream.write(bytes);f.finishWrite(stream);call.resolve();}
  catch(Exception e){if(stream!=null)f.failWrite(stream);call.reject("Could not durably save database");}
 }
 @PluginMethod public void info(PluginCall call) {JSObject out=new JSObject();out.put("version",BuildConfig.VERSION_NAME);out.put("platform","Android "+Build.VERSION.RELEASE);call.resolve(out);}
 @PluginMethod public void exportFile(PluginCall call) {
  String name=call.getString("name","POS-export.txt"),mime=call.getString("mime","application/octet-stream"),data=call.getString("data","");
  if(!name.matches("[A-Za-z0-9._-]{1,120}")||data.length()>LIMIT*4L/3+8){call.reject("Invalid export");return;}
  Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(mime);intent.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(call,intent,"exportResult");
 }
 @ActivityCallback private void exportResult(PluginCall call,ActivityResult result) {
  if(call==null)return;JSObject out=new JSObject();out.put("saved",false);
  if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.resolve(out);return;}
  try(OutputStream stream=getContext().getContentResolver().openOutputStream(result.getData().getData(),"wt")){if(stream==null)throw new IOException();stream.write(Base64.decode(call.getString("data",""),Base64.DEFAULT));out.put("saved",true);call.resolve(out);}catch(Exception e){call.reject("Could not export selected file");}
 }
 @PluginMethod public void importFile(PluginCall call) {Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");startActivityForResult(call,i,"importResult");}
 @ActivityCallback private void importResult(PluginCall call,ActivityResult result) {
  if(call==null)return;JSObject out=new JSObject();if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.resolve(out);return;}
  try {out.put("data",Base64.encodeToString(read(getContext().getContentResolver().openInputStream(result.getData().getData()),LIMIT),Base64.NO_WRAP));call.resolve(out);}catch(Exception e){call.reject("Could not read selected backup");}
 }
 @PluginMethod public void pickImage(PluginCall call) {Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("image/*");startActivityForResult(call,i,"imageResult");}
 @ActivityCallback private void imageResult(PluginCall call,ActivityResult result) {
  if(call==null)return;JSObject out=new JSObject();if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.resolve(out);return;}
  try {byte[] b=read(getContext().getContentResolver().openInputStream(result.getData().getData()),5_000_000);boolean png=b.length>=8&&(b[0]&255)==137&&b[1]==80&&b[2]==78&&b[3]==71&&b[4]==13&&b[5]==10&&b[6]==26&&b[7]==10;boolean jpg=b.length>=3&&(b[0]&255)==255&&(b[1]&255)==216&&(b[2]&255)==255;if(!png&&!jpg)throw new IOException();out.put("data","data:image/"+(png?"png":"jpeg")+";base64,"+Base64.encodeToString(b,Base64.NO_WRAP));call.resolve(out);}catch(Exception e){call.reject("Choose a PNG or JPEG smaller than 5 MB");}
 }
 @PluginMethod public void preview(PluginCall call) {
  String html=call.getString("html","");if(html.length()>8_000_000){call.reject("Receipt is too large");return;}
  try {File f=new File(getContext().getCacheDir(),"receipt.html");try(FileOutputStream out=new FileOutputStream(f)){out.write(html.getBytes(StandardCharsets.UTF_8));}
   Intent i=new Intent(getContext(),ReceiptActivity.class);i.putExtra("paper",call.getString("paper","80mm"));i.putExtra("preview",call.getBoolean("preview",true));String language=call.getString("language","my-MM");if(!java.util.Arrays.asList("my-MM","en-US","th-TH").contains(language))language="my-MM";i.putExtra("language",language);getActivity().startActivity(i);call.resolve();
  }catch(Exception e){call.reject("Could not open receipt preview");}
 }
 @PluginMethod public void copy(PluginCall call) {ClipboardManager clipboard=(ClipboardManager)getContext().getSystemService(android.content.Context.CLIPBOARD_SERVICE);clipboard.setPrimaryClip(ClipData.newPlainText("POS",call.getString("text","")));call.resolve();}
 @PluginMethod public void support(PluginCall call) {try {getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://t.me/kominit")));call.resolve();}catch(Exception e){call.reject("No browser is available");}}
}
