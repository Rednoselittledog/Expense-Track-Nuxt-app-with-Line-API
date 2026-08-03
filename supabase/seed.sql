with new_profile as (
  insert into profiles (locale, cycle_start_day)
  values ('th', 1)
  returning id
),
major_categories as (
  insert into categories (profile_id, name)
  select np.id, v.name
  from new_profile np,
    (values
      ('อาหารและเครื่องดื่ม'),
      ('การเดินทาง'),
      ('ของใช้ประจำวัน'),
      ('ไลฟ์สไตล์และบันเทิง'),
      ('อื่นๆ')
    ) as v(name)
  returning id, name, profile_id
),
sub_categories as (
  insert into categories (profile_id, parent_id, name)
  select mc.profile_id, mc.id, v.sub_name
  from major_categories mc
  join (values
    ('อาหารและเครื่องดื่ม', 'อาหารมื้อหลัก'),
    ('อาหารและเครื่องดื่ม', 'ของว่าง/ขนม'),
    ('อาหารและเครื่องดื่ม', 'เครื่องดื่ม'),
    ('อาหารและเครื่องดื่ม', 'แอลกอฮอล์'),
    ('อาหารและเครื่องดื่ม', 'มื้อพิเศษ/บุฟเฟ่ต์ (รวมจิ้มจุ่ม)'),
    ('การเดินทาง', 'ค่าน้ำมัน'),
    ('การเดินทาง', 'ค่ารถสาธารณะ/แท็กซี่/เรียกรถ'),
    ('การเดินทาง', 'ค่าจอดรถ/ทางด่วน'),
    ('ของใช้ประจำวัน', 'ค่าซักผ้า'),
    ('ของใช้ประจำวัน', 'ของใช้ในบ้าน/เครื่องเขียน'),
    ('ของใช้ประจำวัน', 'เครื่องใช้ไฟฟ้า/ของใช้ชิ้นใหญ่'),
    ('ไลฟ์สไตล์และบันเทิง', 'ดูหนัง/กิจกรรม'),
    ('ไลฟ์สไตล์และบันเทิง', 'ช้อปปิ้งส่วนตัว'),
    ('ไลฟ์สไตล์และบันเทิง', 'งานอดิเรก')
  ) as v(major_name, sub_name) on v.major_name = mc.name
  returning id, name, parent_id
)
select
  (select id from new_profile) as profile_id,
  (select count(*) from major_categories) as major_count,
  (select count(*) from sub_categories) as sub_count;
