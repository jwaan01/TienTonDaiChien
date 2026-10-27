# Báo cáo kiểm tra — bộ 11 tôn giả

## Thành phần

- 26 PNG: 12 sprite sheet + 12 cut-in + stage.png + fx.png.
- 11 nhân vật; riêng U Hồn có 2 dạng chơi được với sheet và cut-in riêng.
- Nhân dạng U Hồn: u-hon-ma-ton_sheet.png / u-hon-ma-ton_cutin.png.
- Hồn thể U Hồn: u-hon-ma-ton_hon-the_sheet.png / u-hon-ma-ton_hon-the_cutin.png.
- 26/26 tên tệp đúng danh sách mở rộng; mọi PNG mở và giải mã được; không có ảnh trùng hoàn toàn theo nội dung pixel.
- PROMPTS.md ghi bộ prompt và chỉnh sửa cuối; MANIFEST.csv ghi kích thước, tỉ lệ, màu nền đo được và mã kiểm tra từng PNG.
- Tạo bằng công cụ image_gen tích hợp; giữ nguyên raster do công cụ xuất, không thay ảnh bằng bản vẽ lập trình.

## Thay đổi ngoại hình theo ảnh người dùng gửi

- Hồng Liên: tóc đen dài, mắt đỏ, dấu sen đỏ, áo đỏ đen.
- Lạc Thổ: đầu trọc, không râu, áo tu hành trắng xám, đai tối.
- Đạo Thiên: tóc nâu ngắn, áo đen cổ lông, không trùm mũ. Dùng người trong mẫu làm nhân dạng, không đưa cơ giáp vào bộ chiêu.
- Vô Cực: tóc bạc xám dài, mắt đỏ, áo đen viền đỏ, giữ xích bạc.
- Cuồng Man: tóc đỏ, cơ bắp lớn, ngực trần, áo choàng đỏ, trang phục tối màu ở hông, hình xăm tối.
- U Hồn nhân dạng: tóc đen dài, mắt đỏ, da nhợt, áo xám đen. Hồn thể: hình thể đen nhiều đầu, nhiều tay, có toàn bộ động tác riêng.
- Các thay đổi này thay thế mô tả ngoại hình cũ theo yêu cầu mới nhất, không phải lỗi đọc prompt.

## Kiểm tra bằng mắt và chỉnh sửa

- Các sheet cuối có 7 hàng ngang và bố cục 4 / 6 / 6 / 6 / 6 / 6 / 6 vị trí khung quan sát được.
- Đã thêm khung chạy thứ sáu của Phương Nguyên, giảm hiệu ứng lớn ở hàng đánh thường.
- Đã thêm nhân vật vào khung thứ tư hàng chiêu đặc biệt của Đạo Thiên.
- Đã bổ sung râu trắng và loại nhân vật đối thủ thừa ở hàng tuyệt chiêu của Nguyên Thủy.
- Cut-in được tạo với chính sheet tương ứng làm tham chiếu. Các nhân vật không dùng lại ảnh Phương Nguyên.

## Sai lệch còn lại — chưa đạt hoàn toàn prompt

1. NỀN: các sheet và fx có nền gần hồng tím nhưng KHÔNG đồng nhất chính xác #FF00FF. Có dao động màu và viền chuyển tiếp; không thể dùng phép so khớp đúng một màu để tách sạch ngay. Tỉ lệ pixel đúng/gần magenta được ghi trong MANIFEST.csv. Chưa giao như bộ nền chroma đã làm sạch.
2. TỈ LỆ: sheet và fx là 1536×1024, đúng 3:2. Cut-in và stage là 1672×941, gần 16:9, lệch khoảng 0,0531%; chưa đúng tuyệt đối 16:9.
3. KHUNG ĐỘNG TÁC: đủ bố cục 7 hàng không đồng nghĩa chu kỳ animation đã được kiểm chứng trong game. Một số khung chạy/idle gần giống nhau; wind-up, strike và recovery chưa phân biệt rõ như prompt. Chưa có tọa độ cắt khung, điểm neo hoặc animation đã dựng thử.
4. HƯỚNG VÀ KHOẢNG CÁCH: phần lớn tư thế chiến đấu hướng phải, nhưng một số tư thế thắng/chịu đòn hoặc hồn thể gần chính diện; chưa đáp ứng tuyệt đối mọi khung đều quay phải. Một số hiệu ứng dài, đặc biệt hàng 5–6, áp sát khung bên cạnh, chưa luôn có khoảng trống rộng. Baseline và chiều cao nhân vật giữa tư thế chưa hoàn toàn đều.
5. CHI TIẾT NGOẠI HÌNH: hình dáng chính của các mẫu đã được áp dụng nhưng không sao chép chính xác mọi chi tiết khuôn mặt/trang phục. Nguyên Liên có tóc dài hơn mô tả ngang vai. Tinh Tú có áo xẻ và trang sức nhiều hơn prompt gốc. Số tay, đầu và hình dạng chi tiết của U Hồn hồn thể chưa hoàn toàn ổn định giữa các tư thế.
6. CHIÊU THỨC: hiệu ứng mang chủ đề từng nhân vật, nhưng không thể hiện chính xác mọi cơ chế trong prompt. Ví dụ Cự Dương chưa thể hiện rõ đủ mười cột vàng và đòn phản tác dụng; Phương Nguyên có lò/lửa nhưng chưa diễn tả đầy đủ cả trời đất; Đạo Thiên thể hiện nắm tay ma nhiều hơn động tác móc Cổ; Cuồng Man chưa biến thành thú khổng lồ rõ rệt ở mọi khung. Không nên xem đây là xác nhận 100% từng chiêu đúng mô tả.
7. PHONG CÁCH: còn vùng ánh sáng, chuyển sắc và chi tiết mềm; chưa hoàn toàn flat cel-shading một tông bóng, no-gradient/no-glow. Mảng đỏ cut-in và stage cũng chưa đồng nhất tuyệt đối #e3203b.

Bộ này đầy đủ tệp để xem xét và phát triển tiếp, nhưng còn các sai lệch trên so với đặc tả kỹ thuật ban đầu. Không tuyên bố toàn bộ ảnh đạt 100% hoặc đã sẵn sàng dùng trực tiếp trong game.
