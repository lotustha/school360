import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/auth_controller.dart';

class LoginView extends StatelessWidget {
  final AuthController controller = Get.put(AuthController());

  LoginView({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Scaffold(
      backgroundColor: colors.surface,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Logo & Brand ──
                _buildHeader(context, colors, theme),
                const SizedBox(height: 32),

                // ── Login Card ──
                _buildLoginCard(context, colors, theme),

                const SizedBox(height: 24),

                // ── Footer ──
                Text(
                  '© 2026 School360. All rights reserved.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF70787d),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    ColorScheme colors,
    ThemeData theme,
  ) {
    return Column(
      children: [
        // Icon badge
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: colors.primary,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(
            Icons.school_rounded,
            size: 28,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Teacher Portal',
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: colors.onSurface,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Sign in to manage your classes and records',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: const Color(0xFF70787d),
          ),
        ),
      ],
    );
  }

  Widget _buildLoginCard(
    BuildContext context,
    ColorScheme colors,
    ThemeData theme,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFc0c8cd), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Card title
          Text(
            'Sign In',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: colors.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Enter your credentials to access your account',
            style: theme.textTheme.bodySmall?.copyWith(
              color: const Color(0xFF70787d),
            ),
          ),

          const SizedBox(height: 24),

          // ── Identifier Field ──
          _buildFieldLabel(theme, 'Email or Mobile'),
          const SizedBox(height: 6),
          TextFormField(
            controller: controller.identifierController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              hintText: 'teacher@school.com',
              prefixIcon: Icon(Icons.person_outline_rounded, size: 18),
            ),
          ),

          const SizedBox(height: 20),

          // ── Password Field ──
          _buildFieldLabel(theme, 'Password'),
          const SizedBox(height: 6),
          Obx(
            () => TextFormField(
              controller: controller.passwordController,
              obscureText: controller.obscurePassword.value,
              decoration: InputDecoration(
                hintText: '••••••••',
                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 18),
                suffixIcon: IconButton(
                  icon: Icon(
                    controller.obscurePassword.value
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 18,
                    color: const Color(0xFF70787d),
                  ),
                  onPressed: controller.togglePassword,
                  splashRadius: 20,
                ),
              ),
            ),
          ),

          const SizedBox(height: 8),

          // ── Forgot Password ──
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {},
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                foregroundColor: colors.primary,
              ),
              child: Text(
                'Forgot password?',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: colors.primary,
                ),
              ),
            ),
          ),

          const SizedBox(height: 24),

          // ── Sign In Button ──
          Obx(
            () => SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed:
                    controller.isLoading.value ? null : controller.login,
                child: controller.isLoading.value
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Sign In'),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // ── Divider ──
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 1,
                  color: const Color(0xFFc0c8cd),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'or',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF70787d),
                  ),
                ),
              ),
              Expanded(
                child: Container(
                  height: 1,
                  color: const Color(0xFFc0c8cd),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // ── Help text ──
          Center(
            child: Text.rich(
              TextSpan(
                text: 'Need help? Contact your ',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF70787d),
                ),
                children: [
                  TextSpan(
                    text: 'school administrator',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: colors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFieldLabel(ThemeData theme, String label) {
    return Text(
      label,
      style: theme.textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: const Color(0xFF40484d),
        letterSpacing: 0.2,
      ),
    );
  }
}
