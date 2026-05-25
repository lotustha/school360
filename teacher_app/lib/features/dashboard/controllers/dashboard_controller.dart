import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

class DashboardController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = true.obs;
  var routine = [].obs;
  var user = {}.obs;

  @override
  void onInit() {
    super.onInit();
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _storage.read('token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
    fetchDashboardData();
  }

  Future<void> fetchDashboardData() async {
    isLoading.value = true;
    try {
      final profileRes = await _dio.get('/user/profile');
      user.value = profileRes.data;

      final routineRes = await _dio.get('/routine');
      routine.value = routineRes.data['routine'];
    } on DioException catch (e) {
      Get.snackbar('Error', e.response?.data['error'] ?? 'Failed to load data');
    } finally {
      isLoading.value = false;
    }
  }

  void logout() {
    _storage.remove('token');
    _storage.remove('themeColor');
    // Navigate back to Login (handled in view or root controller)
  }
}
