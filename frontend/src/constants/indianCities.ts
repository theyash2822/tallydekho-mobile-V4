/**
 * Cities by Indian State — for Dispatch / Ship-To dropdowns.
 * Covers ~top 40-100 cities per state. Not exhaustive — list grows over time.
 * Keys MUST match INDIAN_STATES exactly (same spellings as Tally Prime).
 */

export const CITIES_BY_STATE: Record<string, string[]> = {
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Anantapur', 'Kadapa',
    'Eluru', 'Ongole', 'Chittoor', 'Machilipatnam', 'Adoni', 'Tenali', 'Proddatur', 'Hindupur', 'Bhimavaram', 'Madanapalle',
    'Guntakal', 'Dharmavaram', 'Gudivada', 'Narasaraopet', 'Tadipatri', 'Mangalagiri', 'Chilakaluripet', 'Yemmiganur', 'Kadiri',
  ],
  'Arunachal Pradesh': [
    'Itanagar', 'Naharlagun', 'Pasighat', 'Tezpur', 'Bomdila', 'Ziro', 'Along', 'Tezu', 'Khonsa', 'Changlang', 'Roing', 'Daporijo', 'Seppa',
  ],
  'Assam': [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon', 'Karimganj', 'Sivasagar',
    'Goalpara', 'Barpeta', 'North Lakhimpur', 'Dhubri', 'Diphu', 'Mangaldoi', 'Hailakandi', 'Lanka', 'Lumding',
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai', 'Katihar', 'Munger',
    'Chhapra', 'Bettiah', 'Saharsa', 'Hajipur', 'Sasaram', 'Dehri', 'Siwan', 'Motihari', 'Nawada', 'Bagaha',
    'Buxar', 'Kishanganj', 'Sitamarhi', 'Jamalpur', 'Jehanabad', 'Aurangabad', 'Lakhisarai',
  ],
  'Chhattisgarh': [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Raigarh', 'Ambikapur', 'Mahasamund',
    'Dhamtari', 'Chirmiri', 'Bhatapara', 'Dalli-Rajhara', 'Naila Janjgir', 'Tilda Newra', 'Mungeli', 'Manendragarh',
  ],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem', 'Sanquelim', 'Cuncolim', 'Quepem', 'Canacona', 'Pernem'],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Navsari',
    'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Mehsana', 'Bhuj', 'Porbandar', 'Palanpur', 'Valsad', 'Vapi',
    'Veraval', 'Godhra', 'Patan', 'Kalol', 'Dahod', 'Botad', 'Amreli', 'Deesa', 'Jetpur', 'Sidhpur', 'Wadhwan',
    'Kheda', 'Mahuva', 'Petlad', 'Visnagar', 'Mandvi', 'Bardoli', 'Modasa',
  ],
  'Haryana': [
    'Faridabad', 'Gurgaon', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula',
    'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Thanesar', 'Kaithal', 'Rewari', 'Palwal', 'Hansi', 'Narnaul', 'Fatehabad',
    'Gohana', 'Tohana', 'Narwana', 'Mandi Dabwali',
  ],
  'Himachal Pradesh': [
    'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Palampur', 'Baddi', 'Sundernagar', 'Chamba', 'Una', 'Kullu',
    'Hamirpur', 'Bilaspur', 'Yol', 'Nahan', 'Paonta Sahib', 'Sujanpur', 'Nurpur', 'Kangra',
  ],
  'Jharkhand': [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Phusro', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar',
    'Chirkunda', 'Chakradharpur', 'Chaibasa', 'Gumla', 'Jhumri Telaiya', 'Saunda', 'Sahibganj', 'Pakur', 'Simdega',
  ],
  'Karnataka': [
    'Bangalore', 'Mysore', 'Hubli-Dharwad', 'Mangalore', 'Belgaum', 'Gulbarga', 'Davanagere', 'Bellary', 'Bijapur', 'Shimoga',
    'Tumkur', 'Raichur', 'Bidar', 'Hospet', 'Hassan', 'Gadag-Betageri', 'Udupi', 'Robertsonpet', 'Bhadravati', 'Chitradurga',
    'Kolar', 'Mandya', 'Chikmagalur', 'Gangawati', 'Bagalkot', 'Ranebennuru', 'Chamrajnagar', 'Karwar', 'Madikeri',
  ],
  'Kerala': [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha', 'Malappuram', 'Kannur', 'Kasaragod',
    'Kottayam', 'Pathanamthitta', 'Idukki', 'Ernakulam', 'Wayanad', 'Manjeri', 'Ponnani', 'Vatakara', 'Kanhangad', 'Payyanur',
    'Koyilandy', 'Parappanangadi', 'Kayamkulam', 'Neyyattinkara', 'Kunnamkulam',
  ],
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa',
    'Murwara (Katni)', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind', 'Chhindwara', 'Guna', 'Shivpuri', 'Vidisha', 'Chhatarpur',
    'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Pithampur', 'Hoshangabad', 'Itarsi', 'Sehore', 'Morena', 'Betul',
    'Seoni', 'Datia', 'Nagda', 'Dhar', 'Balaghat', 'Ashok Nagar', 'Tikamgarh', 'Shahdol', 'Rajgarh',
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kalyan-Dombivli', 'Vasai-Virar', 'Pimpri-Chinchwad',
    'Navi Mumbai', 'Kolhapur', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani',
    'Ichalkaranji', 'Jalna', 'Ambernath', 'Bhiwandi', 'Panvel', 'Satara', 'Beed', 'Yavatmal', 'Kamptee', 'Gondia',
    'Barshi', 'Achalpur', 'Osmanabad', 'Nandurbar', 'Wardha', 'Udgir', 'Hinganghat', 'Ratnagiri', 'Pandharpur',
  ],
  'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching', 'Ukhrul', 'Senapati', 'Tamenglong', 'Jiribam', 'Moreh', 'Mayang Imphal'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Williamnagar', 'Baghmara', 'Resubelpara', 'Nongstoin', 'Mawkyrwat'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Saiha', 'Lawngtlai', 'Mamit'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Mon', 'Zunheboto', 'Phek', 'Kiphire', 'Longleng', 'Peren'],
  'Odisha': [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda',
    'Jeypore', 'Barbil', 'Khordha', 'Sunabeda', 'Rayagada', 'Kendrapara', 'Dhenkanal', 'Paradip', 'Talcher', 'Angul',
    'Phulbani', 'Koraput', 'Jajpur', 'Bhawanipatna',
  ],
  'Punjab': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Hoshiarpur', 'Mohali', 'Batala', 'Pathankot', 'Moga',
    'Abohar', 'Malerkotla', 'Khanna', 'Phagwara', 'Muktsar', 'Barnala', 'Rajpura', 'Firozpur', 'Kapurthala', 'Faridkot',
    'Sunam', 'Sangrur', 'Mansa', 'Nabha', 'Gurdaspur', 'Kharar', 'Gobindgarh',
  ],
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar',
    'Pali', 'Sri Ganganagar', 'Kishangarh', 'Baran', 'Dhaulpur', 'Tonk', 'Beawar', 'Hanumangarh', 'Banswara', 'Sawai Madhopur',
    'Makrana', 'Sujangarh', 'Sardarshahar', 'Ladnu', 'Ratangarh', 'Nokha', 'Nimbahera', 'Suratgarh', 'Rajsamand', 'Lachhmangarh',
    'Rajgarh', 'Nasirabad', 'Nohar', 'Phalodi', 'Nathdwara', 'Pilani', 'Merta City', 'Sojat', 'Neem-Ka-Thana', 'Sirohi',
    'Pratapgarh', 'Jhunjhunu', 'Churu', 'Dausa', 'Karauli', 'Jhalawar', 'Jaisalmer', 'Barmer', 'Chittorgarh',
  ],
  'Sikkim': ['Gangtok', 'Namchi', 'Geyzing', 'Mangan', 'Jorethang', 'Naya Bazar', 'Singtam', 'Rangpo'],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Ranipet', 'Nagercoil', 'Thanjavur',
    'Vellore', 'Kancheepuram', 'Erode', 'Tiruvannamalai', 'Pollachi', 'Rajapalayam', 'Sivakasi', 'Pudukkottai', 'Neyveli', 'Nagapattinam',
    'Viluppuram', 'Tiruchengode', 'Vaniyambadi', 'Theni Allinagaram', 'Udhagamandalam', 'Aruppukkottai', 'Paramakudi', 'Arakkonam', 'Virudhachalam',
    'Srivilliputhur', 'Tindivanam', 'Virudhunagar', 'Karur', 'Valparai', 'Sankarankovil', 'Tenkasi', 'Palani', 'Pattukkottai', 'Tirupathur',
    'Ramanathapuram', 'Udumalaipettai', 'Gobichettipalayam', 'Thiruvarur', 'Thiruvallur', 'Panruti', 'Namakkal', 'Cuddalore', 'Hosur', 'Dindigul',
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet',
    'Miryalaguda', 'Jagtial', 'Mancherial', 'Nirmal', 'Kothagudem', 'Bodhan', 'Sangareddy', 'Metpally', 'Zaheerabad', 'Medak',
    'Siddipet', 'Wanaparthy', 'Kamareddy', 'Tandur',
  ],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailasahar', 'Belonia', 'Khowai', 'Teliamura', 'Sabroom', 'Amarpur', 'Sonamura', 'Bishalgarh'],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Meerut', 'Varanasi', 'Allahabad (Prayagraj)', 'Bareilly', 'Aligarh', 'Moradabad',
    'Saharanpur', 'Gorakhpur', 'Noida', 'Firozabad', 'Loni', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Shahjahanpur', 'Rampur',
    'Mau', 'Farrukhabad', 'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Sambhal', 'Amroha', 'Hardoi', 'Fatehpur',
    'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Modinagar', 'Unnao', 'Jaunpur', 'Lakhimpur', 'Hathras', 'Banda',
    'Pilibhit', 'Barabanki', 'Khurja', 'Gonda', 'Mainpuri', 'Lalitpur', 'Etah', 'Deoria', 'Ujhani', 'Ghazipur',
    'Sultanpur', 'Azamgarh', 'Bijnor', 'Sahaswan', 'Basti', 'Chandausi', 'Akbarpur', 'Ballia', 'Tanda', 'Greater Noida',
    'Shikohabad', 'Shamli', 'Awagarh', 'Kasganj',
  ],
  'Uttarakhand': [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Pithoragarh', 'Ramnagar', 'Manglaur',
    'Nainital', 'Mussoorie', 'Almora', 'Khatima', 'Pauri', 'Kotdwara', 'Tehri',
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur',
    'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat', 'Haldia', 'Raiganj', 'Krishnanagar', 'Nabadwip', 'Medinipur', 'Jalpaiguri',
    'Balurghat', 'Basirhat', 'Bankura', 'Chakdaha', 'Darjeeling', 'Alipurduar', 'Purulia', 'Jangipur', 'Bolpur', 'Bangaon',
    'Cooch Behar',
  ],
  'Andaman & Nicobar Islands': ['Port Blair', 'Bambooflat', 'Garacharma', 'Diglipur', 'Mayabunder', 'Rangat', 'Hut Bay', 'Car Nicobar', 'Campbell Bay'],
  'Chandigarh': ['Chandigarh'],
  'Dadra & Nagar Haveli and Daman & Diu': ['Daman', 'Diu', 'Silvassa', 'Amli', 'Vapi (DNH border)'],
  'Delhi': ['New Delhi', 'Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi', 'Rohini', 'Dwarka', 'Najafgarh', 'Narela', 'Karol Bagh'],
  'Jammu & Kashmir': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua', 'Udhampur', 'Punch', 'Rajouri', 'Kupwara',
    'Pulwama', 'Budgam', 'Bandipore', 'Ganderbal', 'Doda', 'Kishtwar', 'Reasi', 'Ramban', 'Samba',
  ],
  'Ladakh': ['Leh', 'Kargil', 'Nubra', 'Drass', 'Zanskar', 'Khaltsi', 'Diskit'],
  'Lakshadweep': ['Kavaratti', 'Agatti', 'Minicoy', 'Andrott', 'Amini', 'Kalpeni', 'Kadmat', 'Kiltan', 'Chetlat', 'Bitra', 'Bangaram'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Yanam', 'Mahe', 'Ozhukarai', 'Villianur', 'Ariyankuppam'],
};

/** Return city list for a given state name. Falls back to empty array. */
export function getCitiesForState(stateName: string): string[] {
  return CITIES_BY_STATE[stateName] || [];
}
