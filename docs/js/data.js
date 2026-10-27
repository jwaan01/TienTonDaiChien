// Roster of the 11 venerables. Moves are named after the fan-wiki research in
// PROMPTS.md; stats keep every character inside a fair band.
//   hp: max health · speed: walk speed px/frame · power: damage multiplier
//   special: projectile tuning · ultimate: range in px in front of the user
export const ROSTER = [
  {
    id: "phuong-nguyen", name: "Phương Nguyên", title: "Luyện Thiên Ma Tôn", path: "Luyện đạo · Lực đạo",
    color: "#ff8a3d", hp: 1000, speed: 4.2, power: 1.0,
    special: { name: "Vạn Ngã", speed: 10, dmg: 90, size: 1 },
    ultimate: { name: "Luyện Thiên", dmg: 270, range: 520 },
  },
  {
    id: "hong-lien-ma-ton", name: "Hồng Liên Ma Tôn", title: "Hồng Đình · Thời gian đạo", path: "Thời gian đạo",
    color: "#e3203b", hp: 980, speed: 4.4, power: 1.0,
    special: { name: "Vị Lai Ngã", speed: 11, dmg: 85, size: 1 },
    ultimate: { name: "Xuân Thu Thiền · Phá Mệnh", dmg: 280, range: 480 },
  },
  {
    id: "nguyen-lien-tien-ton", name: "Nguyên Liên Tiên Tôn", title: "Mộc đạo · Họa đạo", path: "Mộc đạo",
    color: "#4fbf6a", hp: 1060, speed: 4.0, power: 0.95,
    special: { name: "Thông Chi Đạt Diệp", speed: 8, dmg: 95, size: 1.1, ground: true },
    ultimate: { name: "Nhân Quả Thần Thụ", dmg: 260, range: 460 },
  },
  {
    id: "tinh-tu-tien-ton", name: "Tinh Tú Tiên Tôn", title: "Tiên Vương Thiên Đình", path: "Trí đạo",
    color: "#7c8cff", hp: 940, speed: 4.6, power: 1.0,
    special: { name: "Bất Diệt Tinh Tiêu", speed: 13, dmg: 80, size: 0.9 },
    ultimate: { name: "Tinh Tú Kỳ Bàn", dmg: 270, range: 600 },
  },
  {
    id: "lac-tho-tien-ton", name: "Lạc Thổ Tiên Tôn", title: "Nam Cương · Thổ đạo", path: "Thổ đạo",
    color: "#c89a52", hp: 1120, speed: 3.7, power: 1.0,
    special: { name: "Bất Động Binh", speed: 7, dmg: 100, size: 1.15, ground: true },
    ultimate: { name: "Lạc Thổ Sáng Tạo", dmg: 260, range: 500 },
  },
  {
    id: "cu-duong-tien-ton", name: "Cự Dương Tiên Tôn", title: "Tổ tộc Hoàng Kim · Vận đạo", path: "Vận đạo",
    color: "#ffd60a", hp: 1000, speed: 4.2, power: 1.0,
    special: { name: "Nhu Kim Tạp Trụ", speed: 10, dmg: 90, size: 1 },
    ultimate: { name: "Thiên Địa Vận", dmg: 270, range: 520 },
  },
  {
    id: "dao-thien-ma-ton", name: "Đạo Thiên Ma Tôn", title: "Thâu đạo", path: "Thâu đạo",
    color: "#a35cff", hp: 920, speed: 5.0, power: 0.95, steal: true,
    special: { name: "Vô Hình Thủ", speed: 14, dmg: 75, size: 0.9 },
    ultimate: { name: "Đại Tặc Quỷ Thủ", dmg: 260, range: 480 },
  },
  {
    id: "u-hon-ma-ton", name: "U Hồn Ma Tôn", title: "Ảnh Tông · Hồn đạo", path: "Hồn đạo",
    color: "#9fd4ff", hp: 1000, speed: 4.2, power: 1.0, transform: "u-hon-ma-ton_hon-the",
    special: { name: "Hồn Cầu", speed: 10, dmg: 90, size: 1 },
    ultimate: { name: "Hóa Hồn Thú", dmg: 120, range: 360 },
  },
  {
    id: "cuong-man-ma-ton", name: "Cuồng Man Ma Tôn", title: "Lực đạo · Biến hóa đạo", path: "Lực đạo",
    color: "#ff5a3c", hp: 1150, speed: 3.6, power: 1.15,
    special: { name: "Đồ Đằng", speed: 9, dmg: 100, size: 1.1 },
    ultimate: { name: "Cự Thú Hóa Thân", dmg: 300, range: 420 },
  },
  {
    id: "vo-cuc-ma-ton", name: "Vô Cực Ma Tôn", title: "Cuồng Ma Động", path: "Thiên đạo",
    color: "#c8c8d8", hp: 1040, speed: 4.3, power: 1.05,
    special: { name: "Ngân Tỏa", speed: 12, dmg: 90, size: 1 },
    ultimate: { name: "Cuồng Ma Động", dmg: 280, range: 520 },
  },
  {
    id: "nguyen-thuy-tien-ton", name: "Nguyên Thủy Tiên Tôn", title: "Tôn giả đầu tiên", path: "Khí đạo · Nô đạo",
    color: "#f2e2b0", hp: 1060, speed: 3.9, power: 1.0,
    special: { name: "Nguyên Thủy Khí Tường", speed: 8, dmg: 100, size: 1.1 },
    ultimate: { name: "Mệnh Vận · Vạn Thú", dmg: 270, range: 560 },
  },
];

// U Hồn's soul-beast form: playable only through the "Hóa Hồn Thú" ultimate.
export const FORMS = {
  "u-hon-ma-ton_hon-the": {
    id: "u-hon-ma-ton_hon-the", name: "U Hồn · Hồn Thể", title: "Hồn thú", path: "Hồn đạo",
    color: "#9fd4ff", speed: 4.8, power: 1.3, drawScale: 1.18, duration: 15 * 60,
    special: { name: "Hồn Bạo", speed: 11, dmg: 110, size: 1.2 },
    ultimate: { name: "Toái Hồn Thủ", dmg: 300, range: 520 },
  },
};

export const byId = (id) => ROSTER.find((c) => c.id === id) || FORMS[id];
