#!/usr/bin/env bash
set -e

echo "==========================================="
echo "   PlayNex Android APK Build Utility       "
echo "==========================================="

# Detect Java
if [ -d "/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home" ]; then
  export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home"
fi

if [ -n "$JAVA_HOME" ]; then
  echo "✓ Using JAVA_HOME: $JAVA_HOME"
else
  echo "⚠ JAVA_HOME not set. Using system default java."
fi

# Ensure Gradle wrapper exists or download
cd android
if [ ! -f "gradlew" ]; then
  echo "Installing Gradle wrapper..."
  if command -v gradle >/dev/null 2>&1; then
    gradle wrapper --gradle-version 8.4
  elif command -v brew >/dev/null 2>&1; then
    echo "Running brew install gradle..."
    brew install gradle
    gradle wrapper --gradle-version 8.4
  fi
fi

if [ -f "gradlew" ]; then
  chmod +x gradlew
  echo "Building PlayNex Debug APK..."
  ./gradlew assembleDebug
  echo ""
  echo "==========================================="
  echo "✓ PlayNex APK built successfully!"
  echo "Location: android/app/build/outputs/apk/debug/app-debug.apk"
  echo "==========================================="
  echo ""
  echo "To install on connected POCO F6:"
  echo "  adb install -r app/build/outputs/apk/debug/app-debug.apk"
else
  echo "Android project configured at /android."
  echo "Open the 'android' folder in Android Studio to build, or run: brew install gradle"
fi

