// Country / state / city data for profile dropdowns.
// Curated lists: not exhaustive, but covers major hospitality markets.
// For countries not in STATES, the state field falls back to free text.
// City suggestions come from STATES_CITIES (country|state) or COUNTRY_CITIES (country).

export const COUNTRIES: string[] = [
  'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil',
  'Bulgaria', 'Cambodia', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica',
  'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Dominican Republic',
  'Ecuador', 'Egypt', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Germany',
  'Ghana', 'Greece', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kuwait', 'Latvia', 'Lebanon', 'Lithuania',
  'Luxembourg', 'Malaysia', 'Maldives', 'Malta', 'Mexico', 'Morocco', 'Nepal',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan',
  'Panama', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Saudi Arabia', 'Serbia', 'Singapore', 'Slovakia', 'Slovenia',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Taiwan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
  'Venezuela', 'Vietnam',
]

export const STATES: Record<string, string[]> = {
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  'India': [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
    'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal',
  ],
  'Canada': [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Nova Scotia', 'Ontario',
    'Prince Edward Island', 'Quebec', 'Saskatchewan',
  ],
  'Australia': [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory',
    'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
  ],
  'United Kingdom': ['England', 'Northern Ireland', 'Scotland', 'Wales'],
  'Mexico': [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
    'Chiapas', 'Chihuahua', 'Coahuila', 'Colima', 'Durango', 'Guanajuato',
    'Guerrero', 'Hidalgo', 'Jalisco', 'Mexico City', 'Michoacán', 'Morelos',
    'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo',
    'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala',
    'Veracruz', 'Yucatán', 'Zacatecas',
  ],
  'Brazil': [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
    'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul',
    'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí',
    'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia',
    'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins',
  ],
  'Germany': [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen',
    'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern',
    'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland', 'Saxony',
    'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
  ],
}

// Cities keyed by "Country|State" — used when a state is selected.
export const STATES_CITIES: Record<string, string[]> = {
  'United States|California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Long Beach', 'Anaheim', 'Santa Monica', 'Palm Springs', 'Napa', 'Carmel', 'Monterey'],
  'United States|New York': ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Saratoga Springs', 'Niagara Falls'],
  'United States|Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'Key West', 'Naples', 'Sarasota', 'Daytona Beach', 'Tallahassee'],
  'United States|Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Galveston', 'Corpus Christi'],
  'United States|Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Bloomington', 'Carmel', 'Fishers'],
  'United States|Illinois': ['Chicago', 'Springfield', 'Naperville', 'Aurora', 'Peoria', 'Rockford'],
  'United States|Nevada': ['Las Vegas', 'Reno', 'Henderson', 'Lake Tahoe', 'Carson City'],
  'United States|Hawaii': ['Honolulu', 'Kailua-Kona', 'Hilo', 'Lahaina', 'Wailea', 'Kapaa'],
  'United States|Massachusetts': ['Boston', 'Cambridge', 'Worcester', 'Springfield', 'Provincetown'],
  'United States|Washington': ['Seattle', 'Spokane', 'Tacoma', 'Bellevue', 'Olympia'],
  'United States|Colorado': ['Denver', 'Boulder', 'Aspen', 'Colorado Springs', 'Vail', 'Telluride'],
  'United States|Georgia': ['Atlanta', 'Savannah', 'Augusta', 'Athens'],
  'United States|Arizona': ['Phoenix', 'Tucson', 'Scottsdale', 'Sedona', 'Flagstaff'],
  'United States|Louisiana': ['New Orleans', 'Baton Rouge', 'Lafayette', 'Shreveport'],
  'United States|Tennessee': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Gatlinburg'],
  'United States|Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Hershey', 'Lancaster'],
  'United States|Ohio': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo'],
  'United States|Michigan': ['Detroit', 'Ann Arbor', 'Grand Rapids', 'Traverse City'],
  'United States|Oregon': ['Portland', 'Eugene', 'Bend', 'Salem'],
  'United States|North Carolina': ['Charlotte', 'Raleigh', 'Asheville', 'Greensboro', 'Wilmington'],
  'United States|South Carolina': ['Charleston', 'Myrtle Beach', 'Columbia', 'Hilton Head Island'],

  'India|Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Lonavala'],
  'India|Delhi': ['New Delhi', 'Delhi'],
  'India|Karnataka': ['Bangalore', 'Mysore', 'Mangalore', 'Hubli', 'Coorg'],
  'India|Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Ooty', 'Kodaikanal', 'Mahabalipuram'],
  'India|Goa': ['Panaji', 'Margao', 'Calangute', 'Anjuna', 'Vagator', 'Palolem'],
  'India|Rajasthan': ['Jaipur', 'Udaipur', 'Jodhpur', 'Jaisalmer', 'Pushkar', 'Mount Abu'],
  'India|Kerala': ['Thiruvananthapuram', 'Kochi', 'Munnar', 'Alleppey', 'Kovalam', 'Wayanad'],
  'India|Uttar Pradesh': ['Lucknow', 'Agra', 'Varanasi', 'Kanpur', 'Allahabad', 'Noida'],
  'India|West Bengal': ['Kolkata', 'Darjeeling', 'Siliguri', 'Howrah'],
  'India|Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Dwarka'],
  'India|Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala', 'Dalhousie', 'Kasol'],
  'India|Uttarakhand': ['Dehradun', 'Rishikesh', 'Haridwar', 'Nainital', 'Mussoorie'],
  'India|Telangana': ['Hyderabad', 'Warangal'],

  'Canada|Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton', 'Niagara Falls', 'London'],
  'Canada|Quebec': ['Montreal', 'Quebec City', 'Gatineau', 'Mont-Tremblant'],
  'Canada|British Columbia': ['Vancouver', 'Victoria', 'Whistler', 'Kelowna', 'Tofino'],
  'Canada|Alberta': ['Calgary', 'Edmonton', 'Banff', 'Jasper', 'Lake Louise'],

  'United Kingdom|England': ['London', 'Manchester', 'Liverpool', 'Birmingham', 'Bristol', 'Brighton', 'Bath', 'Oxford', 'Cambridge', 'York'],
  'United Kingdom|Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Inverness', 'St Andrews'],
  'United Kingdom|Wales': ['Cardiff', 'Swansea', 'Newport'],
  'United Kingdom|Northern Ireland': ['Belfast', 'Derry'],

  'Australia|New South Wales': ['Sydney', 'Newcastle', 'Byron Bay', 'Wollongong'],
  'Australia|Victoria': ['Melbourne', 'Geelong', 'Ballarat'],
  'Australia|Queensland': ['Brisbane', 'Gold Coast', 'Cairns', 'Port Douglas', 'Noosa', 'Sunshine Coast'],
  'Australia|Western Australia': ['Perth', 'Margaret River', 'Broome', 'Fremantle'],
  'Australia|South Australia': ['Adelaide', 'Barossa Valley'],
  'Australia|Tasmania': ['Hobart', 'Launceston'],
}

// Fallback: cities by country (when no state cascade or country unknown).
export const COUNTRY_CITIES: Record<string, string[]> = {
  'France': ['Paris', 'Nice', 'Lyon', 'Marseille', 'Bordeaux', 'Cannes', 'Toulouse', 'Strasbourg', 'Saint-Tropez'],
  'Spain': ['Madrid', 'Barcelona', 'Seville', 'Valencia', 'Bilbao', 'Granada', 'Málaga', 'Ibiza', 'Palma'],
  'Italy': ['Rome', 'Milan', 'Florence', 'Venice', 'Naples', 'Turin', 'Bologna', 'Verona', 'Capri', 'Positano'],
  'Germany': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dresden'],
  'Netherlands': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
  'Portugal': ['Lisbon', 'Porto', 'Faro', 'Funchal', 'Algarve'],
  'Greece': ['Athens', 'Thessaloniki', 'Santorini', 'Mykonos', 'Crete', 'Rhodes'],
  'Switzerland': ['Zurich', 'Geneva', 'Bern', 'Basel', 'Lucerne', 'Zermatt', 'St. Moritz', 'Interlaken'],
  'Austria': ['Vienna', 'Salzburg', 'Innsbruck', 'Graz'],
  'Belgium': ['Brussels', 'Antwerp', 'Bruges', 'Ghent'],
  'Ireland': ['Dublin', 'Cork', 'Galway', 'Killarney', 'Limerick'],
  'Norway': ['Oslo', 'Bergen', 'Tromsø', 'Trondheim', 'Stavanger'],
  'Sweden': ['Stockholm', 'Gothenburg', 'Malmö'],
  'Denmark': ['Copenhagen', 'Aarhus', 'Odense'],
  'Finland': ['Helsinki', 'Tampere', 'Turku', 'Rovaniemi'],
  'Iceland': ['Reykjavík', 'Akureyri', 'Vík'],
  'Czech Republic': ['Prague', 'Brno', 'Český Krumlov'],
  'Poland': ['Warsaw', 'Kraków', 'Gdańsk', 'Wrocław'],
  'Turkey': ['Istanbul', 'Antalya', 'Ankara', 'Izmir', 'Bodrum', 'Cappadocia'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras al-Khaimah', 'Fujairah'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina'],
  'Qatar': ['Doha'],
  'Egypt': ['Cairo', 'Alexandria', 'Sharm El Sheikh', 'Hurghada', 'Luxor', 'Aswan'],
  'Morocco': ['Marrakech', 'Casablanca', 'Fes', 'Tangier', 'Rabat', 'Essaouira'],
  'South Africa': ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Port Elizabeth'],
  'Kenya': ['Nairobi', 'Mombasa', 'Kisumu'],
  'Thailand': ['Bangkok', 'Phuket', 'Chiang Mai', 'Krabi', 'Koh Samui', 'Pattaya'],
  'Vietnam': ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hoi An', 'Nha Trang'],
  'Indonesia': ['Jakarta', 'Bali', 'Yogyakarta', 'Bandung', 'Surabaya', 'Ubud'],
  'Malaysia': ['Kuala Lumpur', 'Penang', 'Langkawi', 'Kota Kinabalu', 'Malacca'],
  'Singapore': ['Singapore'],
  'Philippines': ['Manila', 'Cebu', 'Boracay', 'Palawan', 'Davao'],
  'Japan': ['Tokyo', 'Kyoto', 'Osaka', 'Sapporo', 'Hiroshima', 'Nagoya', 'Yokohama'],
  'South Korea': ['Seoul', 'Busan', 'Incheon', 'Jeju'],
  'China': ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Xi\'an'],
  'Hong Kong': ['Hong Kong'],
  'Taiwan': ['Taipei', 'Kaohsiung', 'Taichung'],
  'New Zealand': ['Auckland', 'Wellington', 'Queenstown', 'Christchurch', 'Rotorua'],
  'Brazil': ['Rio de Janeiro', 'São Paulo', 'Salvador', 'Brasília', 'Florianópolis', 'Búzios'],
  'Argentina': ['Buenos Aires', 'Mendoza', 'Bariloche', 'Córdoba'],
  'Chile': ['Santiago', 'Valparaíso', 'San Pedro de Atacama'],
  'Peru': ['Lima', 'Cusco', 'Arequipa'],
  'Colombia': ['Bogotá', 'Cartagena', 'Medellín', 'Santa Marta'],
  'Mexico': ['Mexico City', 'Cancún', 'Playa del Carmen', 'Tulum', 'Puerto Vallarta', 'Cabo San Lucas', 'Oaxaca', 'Guadalajara', 'Monterrey'],
  'Maldives': ['Malé'],
  'Sri Lanka': ['Colombo', 'Kandy', 'Galle', 'Negombo'],
  'Nepal': ['Kathmandu', 'Pokhara'],
}

export interface DialEntry {
  country: string
  code: string
  flag: string
}

// International dialing codes, ordered for usability.
export const DIAL_CODES: DialEntry[] = [
  { country: 'United States', code: '+1', flag: '🇺🇸' },
  { country: 'Canada', code: '+1', flag: '🇨🇦' },
  { country: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { country: 'India', code: '+91', flag: '🇮🇳' },
  { country: 'Australia', code: '+61', flag: '🇦🇺' },
  { country: 'Germany', code: '+49', flag: '🇩🇪' },
  { country: 'France', code: '+33', flag: '🇫🇷' },
  { country: 'Italy', code: '+39', flag: '🇮🇹' },
  { country: 'Spain', code: '+34', flag: '🇪🇸' },
  { country: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { country: 'Brazil', code: '+55', flag: '🇧🇷' },
  { country: 'Mexico', code: '+52', flag: '🇲🇽' },
  { country: 'Japan', code: '+81', flag: '🇯🇵' },
  { country: 'South Korea', code: '+82', flag: '🇰🇷' },
  { country: 'China', code: '+86', flag: '🇨🇳' },
  { country: 'Hong Kong', code: '+852', flag: '🇭🇰' },
  { country: 'Taiwan', code: '+886', flag: '🇹🇼' },
  { country: 'Singapore', code: '+65', flag: '🇸🇬' },
  { country: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { country: 'Thailand', code: '+66', flag: '🇹🇭' },
  { country: 'Vietnam', code: '+84', flag: '🇻🇳' },
  { country: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { country: 'Philippines', code: '+63', flag: '🇵🇭' },
  { country: 'New Zealand', code: '+64', flag: '🇳🇿' },
  { country: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { country: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { country: 'Qatar', code: '+974', flag: '🇶🇦' },
  { country: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { country: 'Oman', code: '+968', flag: '🇴🇲' },
  { country: 'Israel', code: '+972', flag: '🇮🇱' },
  { country: 'Turkey', code: '+90', flag: '🇹🇷' },
  { country: 'Egypt', code: '+20', flag: '🇪🇬' },
  { country: 'Morocco', code: '+212', flag: '🇲🇦' },
  { country: 'South Africa', code: '+27', flag: '🇿🇦' },
  { country: 'Kenya', code: '+254', flag: '🇰🇪' },
  { country: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { country: 'Ghana', code: '+233', flag: '🇬🇭' },
  { country: 'Tanzania', code: '+255', flag: '🇹🇿' },
  { country: 'Uganda', code: '+256', flag: '🇺🇬' },
  { country: 'Ethiopia', code: '+251', flag: '🇪🇹' },
  { country: 'Tunisia', code: '+216', flag: '🇹🇳' },
  { country: 'Jordan', code: '+962', flag: '🇯🇴' },
  { country: 'Lebanon', code: '+961', flag: '🇱🇧' },
  { country: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { country: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { country: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
  { country: 'Nepal', code: '+977', flag: '🇳🇵' },
  { country: 'Maldives', code: '+960', flag: '🇲🇻' },
  { country: 'Cambodia', code: '+855', flag: '🇰🇭' },
  { country: 'Russia', code: '+7', flag: '🇷🇺' },
  { country: 'Kazakhstan', code: '+7', flag: '🇰🇿' },
  { country: 'Ukraine', code: '+380', flag: '🇺🇦' },
  { country: 'Poland', code: '+48', flag: '🇵🇱' },
  { country: 'Czech Republic', code: '+420', flag: '🇨🇿' },
  { country: 'Slovakia', code: '+421', flag: '🇸🇰' },
  { country: 'Hungary', code: '+36', flag: '🇭🇺' },
  { country: 'Romania', code: '+40', flag: '🇷🇴' },
  { country: 'Bulgaria', code: '+359', flag: '🇧🇬' },
  { country: 'Serbia', code: '+381', flag: '🇷🇸' },
  { country: 'Croatia', code: '+385', flag: '🇭🇷' },
  { country: 'Slovenia', code: '+386', flag: '🇸🇮' },
  { country: 'Greece', code: '+30', flag: '🇬🇷' },
  { country: 'Cyprus', code: '+357', flag: '🇨🇾' },
  { country: 'Malta', code: '+356', flag: '🇲🇹' },
  { country: 'Portugal', code: '+351', flag: '🇵🇹' },
  { country: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { country: 'Austria', code: '+43', flag: '🇦🇹' },
  { country: 'Belgium', code: '+32', flag: '🇧🇪' },
  { country: 'Luxembourg', code: '+352', flag: '🇱🇺' },
  { country: 'Ireland', code: '+353', flag: '🇮🇪' },
  { country: 'Denmark', code: '+45', flag: '🇩🇰' },
  { country: 'Sweden', code: '+46', flag: '🇸🇪' },
  { country: 'Norway', code: '+47', flag: '🇳🇴' },
  { country: 'Finland', code: '+358', flag: '🇫🇮' },
  { country: 'Iceland', code: '+354', flag: '🇮🇸' },
  { country: 'Estonia', code: '+372', flag: '🇪🇪' },
  { country: 'Latvia', code: '+371', flag: '🇱🇻' },
  { country: 'Lithuania', code: '+370', flag: '🇱🇹' },
  { country: 'Argentina', code: '+54', flag: '🇦🇷' },
  { country: 'Chile', code: '+56', flag: '🇨🇱' },
  { country: 'Colombia', code: '+57', flag: '🇨🇴' },
  { country: 'Peru', code: '+51', flag: '🇵🇪' },
  { country: 'Venezuela', code: '+58', flag: '🇻🇪' },
  { country: 'Ecuador', code: '+593', flag: '🇪🇨' },
  { country: 'Uruguay', code: '+598', flag: '🇺🇾' },
  { country: 'Panama', code: '+507', flag: '🇵🇦' },
  { country: 'Costa Rica', code: '+506', flag: '🇨🇷' },
  { country: 'Dominican Republic', code: '+1', flag: '🇩🇴' },
  { country: 'Jamaica', code: '+1', flag: '🇯🇲' },
  { country: 'Iran', code: '+98', flag: '🇮🇷' },
  { country: 'Iraq', code: '+964', flag: '🇮🇶' },
]

export function dialCodeFor(country: string): string {
  return DIAL_CODES.find(d => d.country === country)?.code || '+1'
}

export function parsePhone(p: string, defaultCode: string): { code: string; number: string } {
  if (!p) return { code: defaultCode, number: '' }
  const trimmed = p.trim()
  if (!trimmed.startsWith('+')) return { code: defaultCode, number: trimmed }
  const m = trimmed.match(/^(\+\d{1,4})\s*(.*)$/)
  if (m) return { code: m[1]!, number: (m[2] || '').trim() }
  return { code: defaultCode, number: trimmed }
}

export function citiesFor(country: string, state: string): string[] {
  if (country && state) {
    const key = `${country}|${state}`
    if (STATES_CITIES[key]) return STATES_CITIES[key]
  }
  if (country && COUNTRY_CITIES[country]) return COUNTRY_CITIES[country]
  return []
}

export function statesFor(country: string): string[] {
  return STATES[country] || []
}
