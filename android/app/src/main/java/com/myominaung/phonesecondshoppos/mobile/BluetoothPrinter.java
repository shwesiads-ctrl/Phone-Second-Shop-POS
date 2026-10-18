package com.myominaung.phonesecondshoppos.mobile;
import android.bluetooth.*;
import android.graphics.Bitmap;
import java.io.*;
import java.util.UUID;
import java.util.concurrent.*;
/** Classic SPP ESC/POS only. No BLE, hidden pairing, automatic retry, or claim of paper acknowledgement. */
final class BluetoothPrinter {
 static volatile BluetoothSocket socket;
 static volatile String address="";
 static volatile long epoch=0;
 static final ExecutorService worker=Executors.newSingleThreadExecutor();
 static final ScheduledExecutorService timer=Executors.newSingleThreadScheduledExecutor();
 static boolean connected(){return socket!=null&&socket.isConnected();}
 static synchronized void disconnect(){epoch++;BluetoothSocket old=socket;socket=null;address="";if(old!=null)try{old.close();}catch(IOException ignored){}}
 static void connect(BluetoothDevice device,long expected) throws IOException {
  if(device.getBondState()!=BluetoothDevice.BOND_BONDED)throw new IOException("PRINTER_PAIR_FIRST");
  BluetoothSocket next=device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"));
  ScheduledFuture<?> timeout=timer.schedule(()->{try{next.close();}catch(IOException ignored){}},12,TimeUnit.SECONDS);
  synchronized(BluetoothPrinter.class){if(epoch!=expected){try{next.close();}catch(IOException ignored){}timeout.cancel(false);throw new IOException();}BluetoothSocket old=socket;socket=next;address="";if(old!=null)try{old.close();}catch(IOException ignored){}}
  try{next.connect();synchronized(BluetoothPrinter.class){if(socket!=next||epoch!=expected)throw new IOException();address=device.getAddress();}}catch(IOException e){if(socket==next)disconnect();try{next.close();}catch(IOException ignored){}throw e;}finally{timeout.cancel(false);}
 }
 static void print(Bitmap image) throws IOException {
  BluetoothSocket active=socket;if(active==null||!active.isConnected())throw new IOException("PRINTER_NOT_CONNECTED");
  ScheduledFuture<?> timeout=timer.schedule(()->{try{active.close();}catch(IOException ignored){}},30,TimeUnit.SECONDS);
  try{OutputStream out=active.getOutputStream();out.write(new byte[]{27,64});int width=image.getWidth(),stride=(width+7)/8;
   // GS v 0 raster, bounded strips; text is already shaped by Android WebView fonts.
   for(int start=0;start<image.getHeight();start+=128){int h=Math.min(128,image.getHeight()-start);byte[] data=new byte[stride*h];
    for(int y=0;y<h;y++)for(int x=0;x<width;x++){int c=image.getPixel(x,start+y);int lum=(((c>>16)&255)*299+((c>>8)&255)*587+(c&255)*114)/1000;if(lum<160)data[y*stride+x/8]|=(byte)(128>>(x%8));}
    out.write(new byte[]{29,118,48,0,(byte)stride,(byte)(stride>>8),(byte)h,(byte)(h>>8)});out.write(data);
   }out.write(new byte[]{10,10,10});out.flush();
  }catch(IOException e){disconnect();throw e;}finally{timeout.cancel(false);}
 }
}
