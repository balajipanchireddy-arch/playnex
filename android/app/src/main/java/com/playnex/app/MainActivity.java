package com.playnex.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private static final String DEFAULT_URL = "https://playnex-beta.vercel.app/";

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;
    private View errorView;
    private Button btnRetry;

    private ValueCallback<Uri[]> fileUploadCallback;
    private long backPressedTime = 0;

    private final ActivityResultLauncher<Intent> fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (fileUploadCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Intent data = result.getData();
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
    );

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        setupWebView();
        setupBackNavigation();

        loadHome();
        checkForUpdates();
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        errorView = findViewById(R.id.errorView);
        btnRetry = findViewById(R.id.btnRetry);

        swipeRefresh.setColorSchemeResources(R.color.brand_cyan, R.color.brand_primary);
        swipeRefresh.setProgressBackgroundColorSchemeResource(R.color.brand_surface);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        btnRetry.setOnClickListener(v -> {
            errorView.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            webView.reload();
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Append mobile app identifier
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " PlayNexAndroidApp/1.0.0");

        // Enable cookies and session sync
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();

                // Open internal and auth domain inside WebView
                if (host != null && (host.contains("playnex") || host.contains("vercel.app") || host.contains("firebaseapp.com"))) {
                    return false;
                }

                // External links (tel:, mailto:, external browser)
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefresh.setRefreshing(false);
                progressBar.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    webView.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                    swipeRefresh.setRefreshing(false);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    fileChooserLauncher.launch(intent);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish();
                    } else {
                        backPressedTime = System.currentTimeMillis();
                        Toast.makeText(MainActivity.this, "Press back again to exit PlayNex", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });
    }

    private void loadHome() {
        Intent intent = getIntent();
        String targetUrl = DEFAULT_URL;
        if (intent != null && intent.getData() != null) {
            targetUrl = intent.getData().toString();
        }
        webView.loadUrl(targetUrl);
    }

    private void checkForUpdates() {
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL("https://playnex-beta.vercel.app/api/version");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                if (conn.getResponseCode() == 200) {
                    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    org.json.JSONObject json = new org.json.JSONObject(sb.toString());
                    if (json.optBoolean("ok", false) && json.has("data")) {
                        org.json.JSONObject data = json.getJSONObject("data");
                        int remoteVersionCode = data.optInt("versionCode", 1);
                        String remoteVersionName = data.optString("versionName", "1.1.0");
                        String downloadUrl = data.optString("downloadUrl", "https://github.com/balajipanchireddy-arch/playnex/releases/latest/download/PlayNex.apk");
                        String releaseNotes = data.optString("releaseNotes", "New performance and feature updates available.");
                        boolean mandatory = data.optBoolean("mandatory", false);

                        int currentVersionCode = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;

                        if (remoteVersionCode > currentVersionCode) {
                            runOnUiThread(() -> showUpdateDialog(remoteVersionName, releaseNotes, downloadUrl, mandatory));
                        }
                    }
                }
            } catch (Exception e) {
                // Silently ignore update check errors to prevent disrupting user experience
            }
        }).start();
    }

    private void showUpdateDialog(String versionName, String releaseNotes, String downloadUrl, boolean mandatory) {
        androidx.appcompat.app.AlertDialog.Builder builder = new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Update Available (v" + versionName + ")")
                .setMessage(releaseNotes + "\n\nWould you like to download the latest PlayNex APK?")
                .setPositiveButton("Update Now", (dialog, which) -> {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Unable to open download link", Toast.LENGTH_SHORT).show();
                    }
                });

        if (!mandatory) {
            builder.setNegativeButton("Later", (dialog, which) -> dialog.dismiss());
        } else {
            builder.setCancelable(false);
        }

        builder.show();
    }
}

