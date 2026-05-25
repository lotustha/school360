import 'package:get/get.dart';
import 'package:dio/dio.dart';
import 'package:get_storage/get_storage.dart';

class NoticeController extends GetxController {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/mobile/v1'));
  final GetStorage _storage = GetStorage();

  var isLoading = false.obs;
  var notices = [].obs;

  @override
  void onInit() {
    super.onInit();
    fetchNotices();
  }

  Future<void> fetchNotices() async {
    isLoading.value = true;
    try {
      final token = _storage.read('token');
      final response = await _dio.get('/notices', options: Options(headers: {'Authorization': 'Bearer $token'}));
      notices.value = response.data;
    } catch (e) {
      Get.snackbar('Error', 'Failed to load notices');
    } finally {
      isLoading.value = false;
    }
  }
}
