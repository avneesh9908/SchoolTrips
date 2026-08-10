/**
 * Sample rows in exactly the shape the real sheets produce — same column names,
 * same free-text grade spellings — so the mock adapter exercises the same
 * normalize/assemble path as live data. Names here are invented.
 */

export const students = [
  { StudentId: 'S7001', StudentName: 'Aarav Mehta', Grade: 'Grade 7', Section: 'A', FatherName: 'Rakesh Mehta', FatherPhone: '9876543210', FatherEmail: 'rakesh.mehta@example.com' },
  { StudentId: 'S7002', StudentName: 'Isha Mehta', Grade: '9', Section: 'B', FatherName: 'Rakesh Mehta', FatherPhone: '+91 98765 43210', FatherEmail: 'rakesh.mehta@example.com' },
  { StudentId: 'S7003', StudentName: 'Vivaan Shah', Grade: 'VII', Section: 'A', FatherName: 'Nilesh Shah', FatherPhone: '9812345678', FatherEmail: 'nilesh.shah@example.com' },
  // No email on record — proves email sign-in cannot reach a row without one.
  { StudentId: 'S7004', StudentName: 'Diya Patel', Grade: 'Grade 7', Section: 'C', FatherName: 'Amit Patel', FatherPhone: '9900112233', FatherEmail: '' },
  { StudentId: 'S9001', StudentName: 'Kabir Rao', Grade: 'Grade 9', Section: 'A', FatherName: 'Sunil Rao', FatherPhone: '9765432109', FatherEmail: 'sunil.rao@example.com' },
  { StudentId: 'S5001', StudentName: 'Myra Joshi', Grade: 'Grade 5', Section: 'B', FatherName: 'Paresh Joshi', FatherPhone: '9700000001', FatherEmail: 'paresh.joshi@example.com' },
]

export const trips = [
  {
    Grade: 'Grade 7',
    TripTitle: 'Jaipur · Abhaneri · Ranthambore Educational Trip',
    TripDates: 'Batch 1: 12–19 December 2026 · Batch 2: 13–20 December 2026',
    Status: 'Confirmed',
    CoverImage: '',
    Overview:
      'A week-long educational trip for Grade 7 covering Jaipur, Abhaneri and Ranthambore, run across two batches. Please go through the parent and student orientation decks below before the trip.',
    Coordinator: 'Ms. Anjali Desai',
    CoordinatorPhone: '+91 98200 11223',
    CoordinatorEmail: 'trips.grade7@example.edu',
    Emergency: '+91 98200 99887 (24×7 trip desk)',
  },
  {
    Grade: 'Grade 9',
    TripTitle: 'Coorg Field Study',
    TripDates: '6–11 January 2027',
    Status: 'Pending',
    CoverImage: '',
    Overview: 'A five-day field study on plantation ecology and water systems. Dates are provisional pending transport confirmation.',
    Coordinator: 'Mr. Vikram Nair',
    CoordinatorPhone: '+91 98200 44556',
    CoordinatorEmail: 'trips.grade9@example.edu',
    Emergency: '',
  },
]

export const itinerary = [
  { Grade: 'Grade 7', Day: 'Day 1', Time: '10:30 PM', Activity: 'Depart Mumbai Central by MMCT Jaipur SF', Location: 'Mumbai Central' },
  { Grade: 'Grade 7', Day: 'Day 2', Time: 'Afternoon', Activity: 'Arrive Jaipur, check in, orientation walk', Location: 'Jaipur' },
  { Grade: 'Grade 7', Day: 'Day 3', Time: 'Full day', Activity: 'Amer Fort, Jantar Mantar and stepwell study', Location: 'Jaipur' },
  { Grade: 'Grade 7', Day: 'Day 4', Time: 'Morning', Activity: 'Chand Baori stepwell measurement exercise', Location: 'Abhaneri' },
  { Grade: 'Grade 7', Day: 'Day 5', Time: 'Dawn', Activity: 'Ranthambore safari and habitat mapping', Location: 'Ranthambore' },
  { Grade: 'Grade 7', Day: 'Day 6', Time: 'Full day', Activity: 'Project work and presentations at camp', Location: 'Ranthambore' },
  { Grade: 'Grade 7', Day: 'Day 7', Time: '8:20 PM', Activity: 'Board JP BDTS Express for return', Location: 'Jaipur' },
]

export const documents = [
  { Grade: 'Grade 7', Label: "Parent's Orientation deck", Category: 'Orientation', Url: 'https://docs.google.com/presentation/d/1aLt74Pl7Il7gr3imlgqOwwI8Z0Bq8eed49DTbEmL2Ek/edit?usp=sharing' },
  { Grade: 'Grade 7', Label: "Student's Orientation deck", Category: 'Orientation', Url: 'https://docs.google.com/presentation/d/1jOTfBXlf9S6OqQ1GtTZ5OuirUnDvcanls3fmTYMDHwo/edit?usp=sharing' },
  { Grade: 'Grade 7', Label: 'Full day-wise itinerary', Category: 'Itinerary', Url: 'https://docs.google.com/document/d/1hvrj9BRAR0ryKsim8RsAbG3VIwJBPHGZtiK2uHsv9V8/edit?usp=sharing' },
  { Grade: 'Grade 7', Label: 'Orientation poster', Category: 'Orientation', Url: 'https://drive.google.com/file/d/1MreeNsh-JdmK57O6VNRyOYLjECVhCfv2/view?usp=sharing' },
  { Grade: 'Grade 7', Label: "Last year's trip photos", Category: 'Photos', Url: 'https://drive.google.com/drive/folders/1B5CSsY9XkB4uA6Og6Q5WtMNrfeVBWuFJ?usp=sharing' },
]

export const guidelines = [
  { Grade: 'Grade 7', Type: 'Safety', Text: 'A ratio of 1:12 is maintained (one accompanying adult for every 12 students), including teachers, admin, support staff and Safety Monitors.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'Room allocation lets teachers easily monitor students; students know which room their teacher is in.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'One adult accompanies students at all times, including washroom breaks and activities.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'A student orientation is held 15 days before the trip covering safety protocols.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'A trained medical person and first-aid facility are available at the campsite at all times.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'Nearest Police Station and Hospital details are kept handy with the Safety Monitor.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'Accompanying staff receive first-aid training and carry contact details of all parents.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'Staff and vendors are trained under POCSO, with signed undertakings from all vendors.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'Each batch has 2 dedicated Safety Monitors focused solely on student safety.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'Regular WhatsApp updates with photos and videos are shared with parents.' },
  { Grade: 'Grade 7', Type: 'Safety', Text: 'Headcount is taken at every stop and at regular intervals; health checks are done daily at end of day.' },
  { Grade: 'Grade 7', Type: 'Do', Text: 'If your child takes any medicine regularly, hand it to the Safety Monitor a day prior at the bus stop, with clear instructions.' },
  { Grade: 'Grade 7', Type: 'Do', Text: 'Inform the accompanying teacher if your child has any medical history needing personal attention.' },
  { Grade: 'Grade 7', Type: 'Dont', Text: 'Students may not carry personal medicines — staff carry a first-aid box with basics if needed.' },
  { Grade: 'Grade 7', Type: 'Dont', Text: 'Students may not carry mobile phones, smart watches, or other gadgets; these will be confiscated if found.' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Original School ID and Aadhar card (mandatory)' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Clothes for 7 days — full pants, full-sleeve T-shirts, sweatshirts' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Sweater / fleece jacket / thermals' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Night dress' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Heavy woolens' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Shawl / light blanket' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Sport or trekking shoes (compulsory)' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Sandals / slippers' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Water bottle and a shoulder bag to carry it throughout the day' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Towel, napkin, cap or hat, bandana, cotton socks, warm gloves' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Toiletries, moisturizer, sun cream, lip balm' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Mosquito repellent cream — Odomos (compulsory)' },
  { Grade: 'Grade 7', Type: 'Carry', Text: 'Dry, healthy snacks for travelling' },
]

export const reminders = [
  { Grade: 'Grade 7', Date: '1 September', Text: 'Submit signed consent form' },
  { Grade: 'Grade 7', Date: '5 September', Text: 'Submit purchase form and trip fee' },
  { Grade: 'Grade 7', Date: '10 September', Text: 'Submit medical declaration and ID copies' },
]

export const travel = [
  { Grade: 'Grade 7', Leg: 'Onward', TrainNo: 'MMCT JAIPUR SF (12955)', Departure: '10:30 PM', Platform: '', CoachSeat: '3AC — allotment shared a week prior', Notes: 'Report at the platform 60 minutes before departure.' },
  { Grade: 'Grade 7', Leg: 'Return', TrainNo: 'JP BDTS EXP (12980)', Departure: '8:20 PM', Platform: '', CoachSeat: 'Overnight 3AC', Notes: 'Arrives Surat the following morning.' },
]

export const media = []
