import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static ThemeData getThemeFromColor(String hexColor) {
    Color seedColor;
    try {
      final buffer = StringBuffer();
      if (hexColor.length == 6 || hexColor.length == 7) buffer.write('ff');
      buffer.write(hexColor.replaceFirst('#', ''));
      seedColor = Color(int.parse(buffer.toString(), radix: 16));
    } catch (e) {
      seedColor = const Color(0xFF00475e); // Default Academic Precision Primary
    }

    // Academic Precision Colors
    const Color surfaceColor = Color(0xFFf8f9fa);
    const Color onSurfaceColor = Color(0xFF191c1d);
    final Color primaryColor = seedColor;
    
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        brightness: Brightness.light,
        surface: surfaceColor,
        onSurface: onSurfaceColor,
        primary: primaryColor,
      ),
      scaffoldBackgroundColor: surfaceColor,
      textTheme: GoogleFonts.interTextTheme(),
      
      // Cards (Level 1 Elevation)
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: Color(0xFFE9ECEF), width: 1),
        ),
        margin: EdgeInsets.zero,
      ),

      // Inputs
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.5),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: Color(0xFFE9ECEF), width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: Color(0xFFE9ECEF), width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: BorderSide(color: primaryColor.withOpacity(0.5), width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: Color(0xFFba1a1a), width: 1),
        ),
      ),
      
      // Buttons
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          elevation: 0,
          foregroundColor: primaryColor,
          side: BorderSide(color: primaryColor, width: 1),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      
      // App Bar
      appBarTheme: AppBarTheme(
        backgroundColor: surfaceColor,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Color(0xFF191c1d)),
        titleTextStyle: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: Color(0xFF191c1d)),
      ),
    );
  }
}
