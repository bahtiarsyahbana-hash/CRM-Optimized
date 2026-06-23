import type { SourceClient } from '../types';

export interface JanuaryActualClientSeed {
  companyName: string;
  aliases?: string[];
  companyAddress?: string;
  sourceClient: SourceClient;
}

/**
 * Primary clients appearing in the January 2026 actual-production register.
 * QQ parties are intentionally excluded and remain deal-level data.
 */
export const JANUARY_ACTUAL_CLIENTS: JanuaryActualClientSeed[] = [
  { companyName: 'Hutomo Tata Mandiri', sourceClient: 'Client Existing' },
  { companyName: 'PT Geosys energi Prima', sourceClient: 'Client Existing' },
  {
    companyName: 'PT Anindo Perkasa Abadi',
    companyAddress: 'Komp. Pelabuhan Perikanan Samudera Bitung, Jl. Madidihang Kelurahan Aertrmbaga, Kota Bitung Sulawesi Utara, Bitung',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'PT JWBenua Bahari Nusantara',
    aliases: ['PT JW Benua Bahari Nusantara'],
    companyAddress: 'Jl. Pantai Indah Utara, Ruko Galeri Niaga Maditerania 1 Blok X3 D8K, PIK',
    sourceClient: 'Client Existing',
  },
  { companyName: 'Permata International PTE. LTD', sourceClient: 'Client Existing' },
  {
    companyName: 'Herdy Wetan',
    companyAddress: 'Jl. P. Mutiara Blok SD/20 RT. 10/6 Pluit, Penjaringan',
    sourceClient: 'Client Existing',
  },
  { companyName: 'Leonardi Husada', sourceClient: 'Client Existing' },
  {
    companyName: 'Victor Roy Teguh',
    aliases: ['Mr Victor Roy Teguh'],
    companyAddress: 'Jl. Pluit Timur 2 No.4, Jakarta Utara',
    sourceClient: 'Client Existing',
  },
  { companyName: 'SCG Barito Logistic', sourceClient: 'Client Existing' },
  { companyName: 'PT Jaya Gemilang Sukses', sourceClient: 'Client Existing' },
  { companyName: 'CV Lautan Emas Trading', sourceClient: 'Client Existing' },
  { companyName: 'PT Makmur Abadi Jaya', sourceClient: 'Client Existing' },
  {
    companyName: 'PT Zuri Hotel Manajemen',
    companyAddress: 'Jl. Mangga Dua Dalam No.55-56 RT006, Mangga Dua Selatan, Sawah Besar, DKI Jakarta',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'PT Metro Auto Indo',
    companyAddress: 'Jl. Nangka Raya No.88, Tanjung Barat Jagakarsa, Jakarta Selatan 12530, Jakarta Selatan',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'PT Nagasena Adilestari',
    companyAddress: 'Komp. Duta Garden Square Blok A No.29, Jl. Husein Sastranegara, Banten',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'Mr. Saint Liaw',
    aliases: ['Saint Liaw'],
    companyAddress: 'Katamaran Permai I No.24, Pantai Indah Kapuk, Jakarta',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'PT Usaha Nusa Bangun',
    companyAddress: 'Jl. Sam Ratulangi No.112, Manado, Sulawesi Utara',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'Lawrence Wien Sulim',
    companyAddress: 'Pergudangan Bandara Benda Permai G 15, Tangerang, Banten',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'PT Multi Artha Propertindo',
    aliases: ['PT Multiartha Propertindo'],
    companyAddress: 'Komplek Desltasilicon 3 Ext Industrial Park, Jalan Johar Blok F8-25C Desa Kel. Cicau, Kec. Cikarang Pusat, Kab. Bekasi, Jawa Barat',
    sourceClient: 'Client Existing',
  },
  { companyName: 'Feri Sapry', sourceClient: 'New Business' },
  {
    companyName: 'PT Sinar Atom Indonesia',
    companyAddress: 'Jl. Moh Toha No.98, Margasari Karawaci, Kota Tangerang, Banten',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'PT Indo Raya Energi',
    companyAddress: 'Jl. Mangga Dua Raya Ruko Texttile, Blok C No.1, Jakarta',
    sourceClient: 'Client Existing',
  },
  { companyName: 'PT Karunia Sejahtera Trans', sourceClient: 'Client Existing' },
  {
    companyName: 'PT Tritoba Samudera Indonesia',
    companyAddress: 'Jl. Muara Baru Ujung Bok M No. 1,2,11,12 RW017, Penjaringan, Jakarta Utara',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'PT Astsa Makmur Abadi',
    aliases: ['Asta Makmur Abadi', 'PT Asta Makmur Abadi'],
    companyAddress: 'Komplek Green Sedayu Bizpark, Jl. Daan Mogor 15, Kalidere, Jakarta Barat',
    sourceClient: 'Client Existing',
  },
  { companyName: 'Vicky Vegilius Gunawan', sourceClient: 'Client Existing' },
  { companyName: 'Yuanita Tjoatjawinata', sourceClient: 'Client Existing' },
  {
    companyName: 'Santoni',
    companyAddress: 'Jl. Prof HM. Yamin No.169, Kel. Sel Kera Hilir II, Kec. Medan Perjuangan, kota Medan, Sumatera Utara',
    sourceClient: 'Client Existing',
  },
  {
    companyName: 'BPR Dana Mandiri Bogor',
    aliases: ['PT BPR Dana Mandiri Bogor'],
    companyAddress: 'Jl. Raya Puncak No.402, Seuseupan - Ciawi, Kab. Bogor - Provinsi Jawa Barat',
    sourceClient: 'Client Existing',
  },
  { companyName: 'BPR Dana Mandiri Bekasi', sourceClient: 'Client Existing' },
  { companyName: 'PT Asta Kanti Insurance Broker', sourceClient: 'Client Existing' },
];

export function normalizePrimaryClientName(name: string): string {
  return name
    .split(/\s+QQ\s+/i)[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(pt|cv|mr|mrs|pte|ltd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}
