// Nepal Administrative Divisions — Provinces → Districts → Municipalities
// Source: Government of Nepal, Ministry of Federal Affairs and General Administration

export const PROVINCES = [
  { id: "P1", name: "Koshi Province" },
  { id: "P2", name: "Madhesh Province" },
  { id: "P3", name: "Bagmati Province" },
  { id: "P4", name: "Gandaki Province" },
  { id: "P5", name: "Lumbini Province" },
  { id: "P6", name: "Karnali Province" },
  { id: "P7", name: "Sudurpashchim Province" },
] as const

export const DISTRICTS: Record<string, string[]> = {
  P1: [
    "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang",
    "Morang", "Okhaldhunga", "Panchthar", "Sankhuwasabha",
    "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur",
  ],
  P2: [
    "Bara", "Dhanusha", "Mahottari", "Parsa",
    "Rautahat", "Saptari", "Sarlahi", "Siraha",
  ],
  P3: [
    "Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu",
    "Kavrepalanchok", "Lalitpur", "Makwanpur", "Nuwakot",
    "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok",
  ],
  P4: [
    "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang",
    "Mustang", "Myagdi", "Nawalparasi East", "Parbat", "Syangja", "Tanahun",
  ],
  P5: [
    "Arghakhanchi", "Banke", "Bardiya", "Dang", "Eastern Rukum",
    "Gulmi", "Kapilvastu", "Nawalparasi West", "Palpa",
    "Pyuthan", "Rolpa", "Rupandehi",
  ],
  P6: [
    "Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla",
    "Kalikot", "Mugu", "Salyan", "Surkhet", "Western Rukum",
  ],
  P7: [
    "Achham", "Baitadi", "Bajhang", "Bajura",
    "Dadeldhura", "Doti", "Kailali", "Kanchanpur",
  ],
}

// Municipalities (Metropolitan / Sub-Metropolitan / Municipality / Rural Municipality)
export const MUNICIPALITIES: Record<string, string[]> = {
  // ── P1: Koshi ──────────────────────────────────────────────────────────────
  Jhapa: [
    "Arjundhara Municipality", "Bhadrapur Municipality", "Birtamod Municipality",
    "Buddhashanti Municipality", "Damak Municipality", "Gauradaha Municipality",
    "Haldibari Rural Municipality", "Jhapa Rural Municipality", "Kachankawal Rural Municipality",
    "Kankai Municipality", "Kamal Rural Municipality", "Mechinagar Municipality",
    "Pathari Shanischare Municipality", "Shivasataxi Municipality",
  ],
  Morang: [
    "Biratnagar Metropolitan City", "Belbari Municipality", "Budhiganga Municipality",
    "Dhanpalthan Rural Municipality", "Gramthan Rural Municipality",
    "Industri Bihar Rural Municipality", "Jahada Rural Municipality",
    "Katahari Rural Municipality", "Kerabari Municipality", "Letang Bhogateni Municipality",
    "Patahrishanischare Municipality", "Rangeli Municipality",
    "Ratuwamai Rural Municipality", "Srijangha Municipality", "Sunawarshi Municipality",
    "Sundarharaicha Municipality", "Tokse Rural Municipality", "Uralabari Municipality",
    "Miklajung Rural Municipality",
  ],
  Sunsari: [
    "Dharan Sub-Metropolitan City", "Inaruwa Municipality", "Itahari Sub-Metropolitan City",
    "Barahkshetra Municipality", "Bhokraha Narsingh Municipality", "Dewanganj Rural Municipality",
    "Dudhaura Rural Municipality", "Gadhi Municipality", "Harinagar Rural Municipality",
    "Koshi Rural Municipality", "Ramdhuni Municipality",
  ],
  Ilam: [
    "Ilam Municipality", "Chulachuli Rural Municipality", "Deumai Municipality",
    "Fakphokthum Rural Municipality", "Mai Municipality", "Maijogmai Rural Municipality",
    "Mangsebung Rural Municipality", "Rong Rural Municipality", "Sandakpur Rural Municipality",
    "Suryodaya Municipality",
  ],
  Dhankuta: [
    "Dhankuta Municipality", "Chhathar Jorpati Rural Municipality", "Mahalaxmi Municipality",
    "Pakhribas Municipality", "Sahidbhumi Rural Municipality", "Sangurigadhi Rural Municipality",
    "Shahidbhumi Rural Municipality",
  ],
  Taplejung: [
    "Phungling Municipality", "Aathrai Triveni Rural Municipality", "Meringden Rural Municipality",
    "Mikwakhola Rural Municipality", "Phaktanglung Rural Municipality",
    "Sidingba Rural Municipality", "Sirijangha Rural Municipality",
    "Tamba Rural Municipality", "Yangwarak Rural Municipality",
  ],
  Panchthar: [
    "Phidim Municipality", "Falgunanda Rural Municipality", "Hilihang Rural Municipality",
    "Kummayak Rural Municipality", "Miklajung Rural Municipality",
    "Phalelung Rural Municipality", "Tumbewa Rural Municipality", "Yangrakhola Rural Municipality",
  ],
  Sankhuwasabha: [
    "Chainpur Municipality", "Bhotkhola Rural Municipality", "Chichila Rural Municipality",
    "Dharmadevi Municipality", "Khandbari Municipality", "Madi Rural Municipality",
    "Makalu Rural Municipality", "Panchakhapan Municipality", "Sabhapokhari Rural Municipality",
    "Silichong Rural Municipality",
  ],
  Bhojpur: [
    "Bhojpur Municipality", "Aamchok Rural Municipality", "Arun Rural Municipality",
    "Hatuwagadhi Rural Municipality", "Pauwadungma Rural Municipality",
    "Ramprasad Rai Rural Municipality", "Shadananda Municipality", "Tyamke Yuwa Rural Municipality",
  ],
  Solukhumbu: [
    "Solu Dudhkunda Municipality", "Dudhkoshi Rural Municipality", "Khumbu Pasanglhamu Rural Municipality",
    "Likhu Pike Rural Municipality", "Mahakulung Rural Municipality",
    "Necha Salyan Rural Municipality", "Sotang Rural Municipality", "Thulung Dudhkoshi Rural Municipality",
  ],
  Okhaldhunga: [
    "Okhaldhunga Municipality", "Champadevi Rural Municipality", "Chisankhugadhi Rural Municipality",
    "Khijidemba Rural Municipality", "Likhupike Rural Municipality",
    "Manebhanjyang Rural Municipality", "Molung Rural Municipality",
    "Siddhicharan Municipality", "Sunkoshi Rural Municipality",
  ],
  Khotang: [
    "Diktel Rupakot Majhuwagadhi Municipality", "Aiselukharka Rural Municipality",
    "Barahapokhari Rural Municipality", "Budhakaran Rural Municipality",
    "Diprung Chuichumma Rural Municipality", "Halesi Tuwachung Municipality",
    "Jantedhunga Rural Municipality", "Kepilasgadhi Rural Municipality",
    "Khotehang Rural Municipality", "Sakela Rural Municipality",
  ],
  Terhathum: [
    "Myanglung Municipality", "Aathrai Rural Municipality", "Chhathar Rural Municipality",
    "Fedap Rural Municipality", "Laligurans Rural Municipality",
    "Menchhayam Rural Municipality", "Phedap Rural Municipality",
  ],
  Udayapur: [
    "Katari Municipality", "Belaka Municipality", "Chaudandigadhi Municipality",
    "Limchungbung Rural Municipality", "Rautamai Rural Municipality",
    "Sunkoshi Rural Municipality", "Tapli Rural Municipality", "Triyuga Municipality",
    "Udayapurgadhi Rural Municipality",
  ],

  // ── P2: Madhesh ────────────────────────────────────────────────────────────
  Dhanusha: [
    "Janakpurdham Sub-Metropolitan City", "Aurahi Municipality", "Bateshwar Municipality",
    "Bideha Municipality", "Dhanauji Rural Municipality", "Ganeshman Charnath Municipality",
    "Hansapur Municipality", "Janaknandini Rural Municipality", "Kamala Municipality",
    "Lakshminiya Rural Municipality", "Mithila Municipality", "Mithila Bihari Municipality",
    "Mukhiyapatti Musharniya Municipality", "Nagarain Municipality", "Sahidnagar Municipality",
    "Sabaila Municipality", "Vijayapur Municipality",
  ],
  Mahottari: [
    "Jaleshwar Municipality", "Aurahi Municipality", "Balawa Municipality",
    "Bardibas Municipality", "Bhangaha Municipality", "Gaushala Municipality",
    "Loharpatti Municipality", "Mahottari Municipality", "Manara Siswa Municipality",
    "Matihani Municipality", "Pipra Rural Municipality", "Ramgopalpur Municipality",
    "Samsi Rural Municipality", "Sonama Rural Municipality",
  ],
  Sarlahi: [
    "Malangwa Municipality", "Bagmati Municipality", "Balara Municipality",
    "Barahathawa Municipality", "Bishnu Rural Municipality", "Chakraghatta Municipality",
    "Chandranagar Municipality", "Dhankaul Rural Municipality", "Godaita Municipality",
    "Haripurwa Municipality", "Haripur Municipality", "Ishworpur Municipality",
    "Kabilasi Municipality", "Lalbandi Municipality", "Ramnagar Municipality",
    "Harion Municipality",
  ],
  Rautahat: [
    "Gaur Municipality", "Baudhimai Municipality", "Brindaban Municipality",
    "Chandrapur Municipality", "Devahi Gonahi Municipality", "Durga Bhawani Rural Municipality",
    "Garuda Municipality", "Gujara Municipality", "Ishanath Municipality",
    "Katahariya Municipality", "Madhav Narayan Municipality", "Maulapur Municipality",
    "Paroha Municipality", "Phatuwa Bijayapur Municipality", "Rajdevi Municipality",
    "Rajpur Municipality",
  ],
  Bara: [
    "Kalaiya Sub-Metropolitan City", "Adarshkotwal Municipality", "Baragadhi Municipality",
    "Devtal Municipality", "Jitpur Simara Sub-Metropolitan City", "Karaiyamai Municipality",
    "Kolhabi Municipality", "Mahagadhimai Municipality", "Nijgadh Municipality",
    "Pacharauta Municipality", "Pheta Rural Municipality", "Prasauni Municipality",
    "Simraungadh Municipality", "Suwarna Municipality",
  ],
  Parsa: [
    "Birgunj Metropolitan City", "Bahudarmai Municipality", "Bindabasini Municipality",
    "Chhipaharmai Municipality", "Dhobini Rural Municipality", "Jagarnathpur Municipality",
    "Jirabhawani Rural Municipality", "Kalikamai Municipality", "Paterwa Sugauli Municipality",
    "Pokhariya Municipality", "Parsagadhi Municipality", "Pokhariya Municipality",
    "Sachivalaya Municipality", "Thori Rural Municipality",
  ],
  Saptari: [
    "Rajbiraj Municipality", "Agnisair Krishna Savaran Rural Municipality",
    "Balan-Bihul Rural Municipality", "Bishnupur Rural Municipality",
    "Bode Barsain Municipality", "Chhinnamasta Rural Municipality",
    "Dakneshwori Rural Municipality", "Hanumannagar Kankalini Municipality",
    "Kanchanrup Municipality", "Khadak Municipality", "Mahadeva Rural Municipality",
    "Rupani Rural Municipality", "Saptakoshi Rural Municipality",
    "Shambhunath Municipality", "Surunga Municipality", "Tirhut Rural Municipality",
  ],
  Siraha: [
    "Siraha Municipality", "Arnama Rural Municipality", "Aurahi Municipality",
    "Bariyarpatti Municipality", "Bhagawanpur Rural Municipality",
    "Bishnupur Rural Municipality", "Dhangadhimai Municipality",
    "Golbazar Municipality", "Kalyanpur Municipality", "Karjanha Municipality",
    "Lahan Municipality", "Mirchaiya Municipality", "Nawarajpur Rural Municipality",
    "Sakhuwanankarkatti Rural Municipality", "Sukhipur Municipality",
  ],

  // ── P3: Bagmati ────────────────────────────────────────────────────────────
  Kathmandu: [
    "Kathmandu Metropolitan City", "Budhanilkantha Municipality",
    "Chandragiri Municipality", "Dakshinkali Municipality",
    "Gokarneshwar Municipality", "Kageshwori Manohara Municipality",
    "Kirtipur Municipality", "Nagarjun Municipality",
    "Shankharapur Municipality", "Tarakeshwar Municipality",
    "Tokha Municipality",
  ],
  Lalitpur: [
    "Lalitpur Metropolitan City", "Bagmati Municipality",
    "Baudhapur Rural Municipality", "Chapagaun Rural Municipality",
    "Godawari Municipality", "Konjyosom Rural Municipality",
    "Lalitpur Metropolitan City", "Mahalaxmi Municipality",
    "Mahankal Rural Municipality", "Mangalbazar Municipality",
  ],
  Bhaktapur: [
    "Bhaktapur Municipality", "Changunarayan Municipality",
    "Madhyapur Thimi Municipality", "Suryabinayak Municipality",
  ],
  Chitwan: [
    "Bharatpur Metropolitan City", "Bachhauli Rural Municipality",
    "Bharatpur Metropolitan City", "Ichchhakamana Rural Municipality",
    "Kalika Municipality", "Khairahani Municipality",
    "Madi Municipality", "Rapti Municipality",
    "Ratnanagar Municipality",
  ],
  Kavrepalanchok: [
    "Banepa Municipality", "Bethanchok Rural Municipality",
    "Bhumlu Rural Municipality", "Chaurideurali Rural Municipality",
    "Dhulikhel Municipality", "Khanikhola Rural Municipality",
    "Mahabharat Rural Municipality", "Mandan Deupur Municipality",
    "Namobuddha Municipality", "Panauti Municipality",
    "Panchkhal Municipality", "Roshi Rural Municipality",
    "Temal Rural Municipality",
  ],
  Makwanpur: [
    "Hetauda Sub-Metropolitan City", "Bagmati Rural Municipality",
    "Bakaiya Rural Municipality", "Bhimphedi Rural Municipality",
    "Indrasarowar Rural Municipality", "Kailash Rural Municipality",
    "Makwanpurgadhi Rural Municipality", "Manahari Rural Municipality",
    "Raksirang Rural Municipality", "Thaha Municipality",
  ],
  Dhading: [
    "Nilkantha Municipality", "Benighat Rorang Rural Municipality",
    "Dhunibesi Municipality", "Gajuri Rural Municipality",
    "Galchi Rural Municipality", "Gangajamuna Rural Municipality",
    "Jwalamukhi Rural Municipality", "Khaniyabas Rural Municipality",
    "Netrawati Dabjong Rural Municipality", "Rubi Valley Rural Municipality",
    "Siddhalek Rural Municipality", "Tripurasundari Municipality",
  ],
  Nuwakot: [
    "Bidur Municipality", "Belkotgadhi Municipality",
    "Bhairabkunda Rural Municipality", "Dupcheshwar Rural Municipality",
    "Kakani Rural Municipality", "Kispang Rural Municipality",
    "Likhu Rural Municipality", "Myagang Rural Municipality",
    "Panchakanya Rural Municipality", "Shivapuri Rural Municipality",
    "Suryagadhi Rural Municipality", "Tadi Rural Municipality",
    "Tarkeshwar Rural Municipality",
  ],
  Rasuwa: [
    "Kalika Rural Municipality", "Gosaikunda Rural Municipality",
    "Naukunda Rural Municipality", "Parbatikunda Rural Municipality",
    "Uttargaya Rural Municipality",
  ],
  Sindhuli: [
    "Kamalamai Municipality", "Dudhauli Municipality",
    "Ghyanglekh Rural Municipality", "Golanjor Rural Municipality",
    "Hariharpurgadhi Rural Municipality", "Marin Rural Municipality",
    "Phikkal Rural Municipality", "Sunkoshi Rural Municipality",
    "Tinpatan Rural Municipality",
  ],
  Ramechhap: [
    "Manthali Municipality", "Doramba Rural Municipality",
    "Gokulganga Rural Municipality", "Khandadevi Rural Municipality",
    "Likhutamakoshi Rural Municipality", "Ramechhap Municipality",
    "Sunapati Rural Municipality", "Umakunda Rural Municipality",
  ],
  Dolakha: [
    "Charikot Municipality", "Bigu Rural Municipality",
    "Bhimeshwor Municipality", "Baiteshwor Rural Municipality",
    "Gaurishankar Rural Municipality", "Jiri Municipality",
    "Kalinchowk Rural Municipality", "Melung Rural Municipality",
    "Shailung Rural Municipality", "Tamakoshi Rural Municipality",
  ],
  Sindhupalchok: [
    "Chautara Sangachokgadhi Municipality", "Bahrabise Municipality",
    "Balefi Rural Municipality", "Barhabise Municipality",
    "Bhotekoshi Rural Municipality", "Helambu Rural Municipality",
    "Indrawati Rural Municipality", "Jugal Rural Municipality",
    "Lisankhu Pakhar Rural Municipality", "Melamchi Municipality",
    "Panchpokhari Thangpal Rural Municipality", "Sunkoshi Rural Municipality",
    "Tripurasundari Rural Municipality",
  ],

  // ── P4: Gandaki ────────────────────────────────────────────────────────────
  Kaski: [
    "Pokhara Metropolitan City", "Annapurna Rural Municipality",
    "Madi Rural Municipality", "Machhapuchchhre Rural Municipality",
    "Rupa Rural Municipality",
  ],
  Gorkha: [
    "Gorkha Municipality", "Aarughat Rural Municipality",
    "Ajirkot Rural Municipality", "Barpak Sulikot Rural Municipality",
    "Bhimsen Thapa Rural Municipality", "Chum Nubri Rural Municipality",
    "Dharche Rural Municipality", "Gandaki Rural Municipality",
    "Palungtar Municipality", "Sahid Lakhan Rural Municipality",
    "Siranchowk Rural Municipality", "Sulikot Rural Municipality",
    "Tsum Nubri Rural Municipality",
  ],
  Lamjung: [
    "Besisahar Municipality", "Dordi Rural Municipality",
    "Dudhpokhari Rural Municipality", "Kwholasothar Rural Municipality",
    "Madhya Nepal Municipality", "Marsyangdi Rural Municipality",
    "Rainas Municipality", "Sundarbazar Municipality",
  ],
  Tanahun: [
    "Damauli Municipality", "Anbukhaireni Rural Municipality",
    "Bandipurr Municipality", "Bhimad Municipality",
    "Bhanu Municipality", "Devghat Rural Municipality",
    "Ghiring Rural Municipality", "Myagde Rural Municipality",
    "Rhishing Rural Municipality", "Shuklagandaki Municipality",
    "Triveni Municipality",
  ],
  Syangja: [
    "Putalibazar Municipality", "Arjunchaupari Rural Municipality",
    "Biruwa Rural Municipality", "Chapakot Municipality",
    "Galyang Municipality", "Harinas Rural Municipality",
    "Kaligandaki Rural Municipality", "Phedikhola Rural Municipality",
    "Waling Municipality",
  ],
  Parbat: [
    "Kushma Municipality", "Bihadi Rural Municipality",
    "Dhorpatan Municipality", "Jaljala Rural Municipality",
    "Mahashila Rural Municipality", "Modi Rural Municipality",
    "Painyu Rural Municipality", "Phalebas Municipality",
    "Parbat Rural Municipality",
  ],
  Baglung: [
    "Baglung Municipality", "Badigad Rural Municipality",
    "Bareng Rural Municipality", "Dhorpatan Municipality",
    "Galkot Municipality", "Jaimini Municipality",
    "Kanthekhola Rural Municipality", "Nisikhola Rural Municipality",
    "Tarakhola Rural Municipality", "Taman Khola Rural Municipality",
  ],
  Myagdi: [
    "Beni Municipality", "Annapurna Rural Municipality",
    "Dhaulagiri Rural Municipality", "Mangala Rural Municipality",
    "MalanMun Rural Municipality", "Raghuganga Rural Municipality",
  ],
  Mustang: [
    "Lomanthang Rural Municipality", "Baragung Muktichhetra Rural Municipality",
    "Dalome Rural Municipality", "Gharpjhong Rural Municipality",
    "Thasang Rural Municipality",
  ],
  Manang: [
    "Chame Rural Municipality", "Manang Ngisyang Rural Municipality",
    "Marsyangdi Rural Municipality", "Narpa Bhumi Rural Municipality",
    "Narphu Rural Municipality",
  ],
  "Nawalparasi East": [
    "Kawasoti Municipality", "Bulingtar Rural Municipality",
    "Devchuli Municipality", "Gaindakot Municipality",
    "Hupsekot Municipality", "Madhyabindu Municipality",
    "Nawalpur Municipality",
  ],

  // ── P5: Lumbini ────────────────────────────────────────────────────────────
  Rupandehi: [
    "Butwal Sub-Metropolitan City", "Bhairahawa (Siddharthanagar) Sub-Metropolitan City",
    "Devdaha Municipality", "Gaidahawa Rural Municipality",
    "Kapilbastu Municipality", "Lumbini Sanskritik Municipality",
    "Marchawari Rural Municipality", "Mayadevi Rural Municipality",
    "Omsatiya Rural Municipality", "Rohini Rural Municipality",
    "Sainamaina Municipality", "Sammarimai Rural Municipality",
    "Shudhodhan Rural Municipality", "Siyari Rural Municipality",
    "Suddhow Rural Municipality", "Tillottama Municipality",
  ],
  Palpa: [
    "Tansen Municipality", "Baglung Municipality",
    "Bagnaskali Rural Municipality", "Mathagadhi Rural Municipality",
    "Nisdi Rural Municipality", "Purbakhola Rural Municipality",
    "Rampur Municipality", "Rainadevi Chhahara Rural Municipality",
    "Ribs Pati Rural Municipality", "Tinahu Rural Municipality",
  ],
  Kapilvastu: [
    "Kapilvastu Municipality", "Banganga Municipality",
    "Bijaynagar Rural Municipality", "Buddhabhumi Municipality",
    "Krishnanagar Municipality", "Maharajgunj Municipality",
    "Mayadevi Rural Municipality", "Shivaraj Municipality",
    "Suddhodhan Rural Municipality", "Yashodhara Rural Municipality",
  ],
  Arghakhanchi: [
    "Sandhikharka Municipality", "Bhumikasthan Municipality",
    "Chhatradev Rural Municipality", "Panini Rural Municipality",
    "Pokharathok Rural Municipality", "Sitganga Municipality",
  ],
  Gulmi: [
    "Resunga Municipality", "Chatrakot Municipality",
    "Chandrakot Rural Municipality", "Dhurkot Rural Municipality",
    "Gulmidarbar Rural Municipality", "Ishma Rural Municipality",
    "Kaligandaki Rural Municipality", "Madane Rural Municipality",
    "Musikot Municipality", "Ruru Rural Municipality",
    "Satyawati Rural Municipality",
  ],
  Dang: [
    "Ghorahi Sub-Metropolitan City", "Tulsipur Sub-Metropolitan City",
    "Babai Rural Municipality", "Bangalachuli Rural Municipality",
    "Dangisharan Rural Municipality", "Gadhawa Rural Municipality",
    "Lamahi Municipality", "Rapti Rural Municipality",
    "Rajpur Rural Municipality", "Shantinagar Rural Municipality",
  ],
  Banke: [
    "Nepalgunj Sub-Metropolitan City", "Baijnath Rural Municipality",
    "Duduwa Rural Municipality", "Janaki Rural Municipality",
    "Khajura Rural Municipality", "Kohalpur Municipality",
    "Narainapur Rural Municipality", "Rapti Sonari Rural Municipality",
  ],
  Bardiya: [
    "Gulariya Municipality", "Badhaiyatal Rural Municipality",
    "Bansgadhi Municipality", "Barbardiya Municipality",
    "Geruwa Rural Municipality", "Madhuwan Municipality",
    "Rajapur Municipality", "Thakurbaba Municipality",
  ],
  Rolpa: [
    "Rolpa Municipality", "Duikholi Rural Municipality",
    "Gangadev Rural Municipality", "Madi Rural Municipality",
    "Pariwartan Rural Municipality", "Rolpa Municipality",
    "Sunilsmriti Rural Municipality", "Thawang Rural Municipality",
    "Tribeni Rural Municipality",
  ],
  Pyuthan: [
    "Pyuthan Municipality", "Airawati Rural Municipality",
    "Gaumukhi Rural Municipality", "Jhimruk Municipality",
    "Lungri Rural Municipality", "Mandavi Rural Municipality",
    "Mallarani Rural Municipality", "Naubahini Rural Municipality",
    "Sarumarani Rural Municipality", "Swargadwary Municipality",
  ],
  "Eastern Rukum": [
    "Putha Uttarganga Rural Municipality", "Bhume Rural Municipality",
    "Sisne Rural Municipality",
  ],

  // ── P6: Karnali ────────────────────────────────────────────────────────────
  Surkhet: [
    "Birendranagar Municipality", "Bheriganga Municipality",
    "Barekot Rural Municipality", "Chaukune Rural Municipality",
    "Chingad Rural Municipality", "Gurbhakot Municipality",
    "Kumakhlochaur Rural Municipality", "Lekhbesi Municipality",
    "Panchapuri Municipality", "Simta Rural Municipality",
  ],
  Dailekh: [
    "Narayan Municipality", "Aathabis Municipality",
    "Bhagawatimai Rural Municipality", "Chamunda Bindrasaini Municipality",
    "Dungeshwar Rural Municipality", "Dullu Municipality",
    "Gurans Rural Municipality", "Mahabu Rural Municipality",
    "Naumule Rural Municipality", "Thantikandh Rural Municipality",
  ],
  Jajarkot: [
    "Bheri Municipality", "Barekot Rural Municipality",
    "Chhedagad Municipality", "Junichande Rural Municipality",
    "Kuse Rural Municipality", "Nalgad Municipality",
    "Sahare Rural Municipality", "Shiwalaya Rural Municipality",
    "Tribeni Rural Municipality",
  ],
  Salyan: [
    "Sharada Municipality", "Bagchaur Municipality",
    "Bangad Kupinde Rural Municipality", "Darma Rural Municipality",
    "Kalimati Rural Municipality", "Kapurkot Rural Municipality",
    "Kumakhlochaur Rural Municipality", "Siddha Kumakh Rural Municipality",
    "Tribeni Municipal", "Chhatreshwori Rural Municipality",
  ],
  Jumla: [
    "Chandannath Municipality", "Guthichaur Rural Municipality",
    "Hima Rural Municipality", "Kanakasundari Rural Municipality",
    "Khadachakra Rural Municipality", "Malikarvata Rural Municipality",
    "Patarasi Rural Municipality", "Sinja Rural Municipality",
    "Tatopani Rural Municipality", "Tila Rural Municipality",
  ],
  Kalikot: [
    "Khandachakra Municipality", "Mahawai Rural Municipality",
    "Naraharinath Rural Municipality", "Pachaljharana Rural Municipality",
    "Palata Rural Municipality", "Raskot Municipality",
    "Sanni Triveni Rural Municipality", "Shubha Kalika Municipality",
    "Tilagufa Municipality",
  ],
  Dolpa: [
    "Thuli Bheri Municipality", "Chharka Tangsong Rural Municipality",
    "Dolpa Municipality", "Jagadulla Rural Municipality",
    "Kaike Rural Municipality", "Mudkechula Rural Municipality",
    "Shey Phoksundo Rural Municipality", "Tribeni Rural Municipality",
    "Tripurasundari Municipal",
  ],
  Humla: [
    "Simkot Rural Municipality", "Adanchuli Rural Municipality",
    "Chankheli Rural Municipality", "Khagakchhhetra Rural Municipality",
    "Namkha Rural Municipality", "Sarkegad Rural Municipality",
    "Tanjakot Rural Municipality",
  ],
  Mugu: [
    "Gamgadhi Rural Municipality", "Chhayanath Rara Municipality",
    "Khatyad Rural Municipality", "Mugum Karmarong Rural Municipality",
    "Soru Rural Municipality",
  ],
  "Western Rukum": [
    "Musikot Municipality", "Aathabis Rural Municipality",
    "Bhume Rural Municipality", "Chaurjahari Municipality",
    "Sanibheri Rural Municipality", "Triveni Rural Municipality",
  ],

  // ── P7: Sudurpashchim ──────────────────────────────────────────────────────
  Kailali: [
    "Dhangadhi Sub-Metropolitan City", "Tikapur Municipality",
    "Ataria Municipality", "Bhajani Municipality",
    "Chure Rural Municipality", "Gauriganga Municipality",
    "Ghodaghodi Municipality", "Janaki Rural Municipality",
    "Joshipur Rural Municipality", "Kailari Rural Municipality",
    "Lamkichuha Municipality", "Mohanyal Rural Municipality",
    "Phatepur Rural Municipality",
  ],
  Kanchanpur: [
    "Mahendranagar Municipality", "Bedkot Municipality",
    "Belauri Municipality", "Bhimdatta Municipality",
    "Beldandi Rural Municipality", "Dodhara Chandani Municipality",
    "Krishna Prasai Rural Municipality", "Laljhadi Rural Municipality",
    "Purbe Rural Municipality", "Shuklaphanta Municipality",
  ],
  Doti: [
    "Dipayal Silgadhi Municipality", "Aadarsha Municipality",
    "Badikedar Rural Municipality", "Bogtan Fudsil Rural Municipality",
    "Jorayal Rural Municipality", "K.I. Singh Rural Municipality",
    "Purbichauki Rural Municipality", "Sayal Rural Municipality",
    "Shikhar Municipality",
  ],
  Achham: [
    "Mangalsen Municipality", "Bannigadhi Jayagadh Rural Municipality",
    "Chaurpati Rural Municipality", "Dhakari Rural Municipality",
    "Kamalbazar Municipality", "Mellekh Rural Municipality",
    "Panchadeval Binayak Municipality", "Ramaroshan Rural Municipality",
    "Sanfebagar Municipality", "Turmakhad Rural Municipality",
  ],
  Bajura: [
    "Budhinanda Municipality", "Badimalika Municipality",
    "Budhiganga Rural Municipality", "Gaumul Rural Municipality",
    "Himali Rural Municipality", "Jagannath Rural Municipality",
    "Khaptad Chhanna Rural Municipality", "Swami Kartik Khapar Rural Municipality",
    "Tribeni Rural Municipality",
  ],
  Bajhang: [
    "Jayaprithvi Municipality", "Bungal Municipality",
    "Chhanna Rural Municipality", "Durgathali Rural Municipality",
    "Kedarsyu Rural Municipality", "Khaptad Chhanna Rural Municipality",
    "Masta Rural Municipality", "Patuwa Dandakasthan Rural Municipality",
    "Surma Rural Municipality", "Talkot Municipality",
    "Thalara Rural Municipality", "Wai Rural Municipality",
  ],
  Baitadi: [
    "Dasharathchand Municipality", "Dilasaini Municipality",
    "Dogadakedar Rural Municipality", "Melauli Municipality",
    "Pancheshwar Rural Municipality", "Patan Municipality",
    "Purchaudi Municipality", "Shivanath Rural Municipality",
    "Sigas Rural Municipality", "Surnaya Rural Municipality",
  ],
  Dadeldhura: [
    "Amargadhi Municipality", "Aalital Rural Municipality",
    "Ajayameru Rural Municipality", "Bhageshwar Rural Municipality",
    "Ganyapdhura Rural Municipality", "Nawadurga Rural Municipality",
    "Parashuram Municipality",
  ],
}

/** Get districts for a given province ID */
export function getDistricts(provinceId: string): string[] {
  return DISTRICTS[provinceId] ?? []
}

/** Get municipalities for a given district name */
export function getMunicipalities(district: string): string[] {
  return MUNICIPALITIES[district] ?? []
}
