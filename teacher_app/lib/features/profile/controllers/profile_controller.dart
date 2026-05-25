import 'package:get/get.dart';
import 'package:dio/dio.dart';
import 'package:get_storage/get_storage.dart';
import '../../auth/views/login_view.dart';

class ProfileController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = true.obs;
  var profile = {}.obs;

  @override
  void onInit() {
    super.onInit();
    fetchProfile();
  }

  Future<void> fetchProfile() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get(
        '/profile',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      profile.value = response.data;
    } catch (e) {
      Get.snackbar('Error', 'Failed to load profile');
    } finally {
      isLoading.value = false;
    }
  }

  void logout() {
    _storage.remove('token');
    _storage.remove('themeColor');
    Get.offAll(() => LoginView());
  }
}
