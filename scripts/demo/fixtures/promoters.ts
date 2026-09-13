export interface PromoterIdentity {
  id: string;
  email: string;
  name: string;
  phone: string;
  referralCode: string;
  channel: string;
  status: "ACTIVE" | "PENDING";
}

export const DEMO_PROMOTERS: PromoterIdentity[] = [
  {
    "id": "promo-001",
    "email": "promoter.themba.du.plessis1@ktcouriers.local",
    "name": "Themba Du Plessis",
    "phone": "+27 81 251 4924",
    "referralCode": "JHBVIBES",
    "channel": "COMMUNITY",
    "status": "ACTIVE"
  },
  {
    "id": "promo-002",
    "email": "promoter.kefilwe.matlala2@ktcouriers.local",
    "name": "Kefilwe Matlala",
    "phone": "+27 82 528 4926",
    "referralCode": "SANDTONEATS",
    "channel": "INSTAGRAM",
    "status": "ACTIVE"
  },
  {
    "id": "promo-003",
    "email": "promoter.tshepo.mokoena3@ktcouriers.local",
    "name": "Tshepo Mokoena",
    "phone": "+27 82 296 1844",
    "referralCode": "JOZILIVING",
    "channel": "TIKTOK",
    "status": "ACTIVE"
  },
  {
    "id": "promo-004",
    "email": "promoter.priya.daniels4@ktcouriers.local",
    "name": "Priya Daniels",
    "phone": "+27 83 756 7679",
    "referralCode": "CAPETOWNDEALS",
    "channel": "COMMUNITY",
    "status": "ACTIVE"
  },
  {
    "id": "promo-005",
    "email": "promoter.karabo.van.der.merwe5@ktcouriers.local",
    "name": "Karabo Van Der Merwe",
    "phone": "+27 82 408 7431",
    "referralCode": "DURBANSPICE",
    "channel": "FOOD_BLOG",
    "status": "ACTIVE"
  },
  {
    "id": "promo-006",
    "email": "promoter.preetha.ncube6@ktcouriers.local",
    "name": "Preetha Ncube",
    "phone": "+27 81 451 4099",
    "referralCode": "HEALTHYZA",
    "channel": "FOOD_BLOG",
    "status": "ACTIVE"
  },
  {
    "id": "promo-007",
    "email": "promoter.reneilwe.pretorius7@ktcouriers.local",
    "name": "Reneilwe Pretorius",
    "phone": "+27 84 286 9684",
    "referralCode": "FRESHDELIVERY",
    "channel": "TIKTOK",
    "status": "ACTIVE"
  },
  {
    "id": "promo-008",
    "email": "promoter.jan.matlala8@ktcouriers.local",
    "name": "Jan Matlala",
    "phone": "+27 82 212 9186",
    "referralCode": "SHOPLOCALZA",
    "channel": "TIKTOK",
    "status": "ACTIVE"
  },
  {
    "id": "promo-009",
    "email": "promoter.tanya.dlamini9@ktcouriers.local",
    "name": "Tanya Dlamini",
    "phone": "+27 83 530 5604",
    "referralCode": "CAMPUSKT",
    "channel": "CAMPUS_BRAND",
    "status": "ACTIVE"
  },
  {
    "id": "promo-010",
    "email": "promoter.farai.zuma10@ktcouriers.local",
    "name": "Farai Zuma",
    "phone": "+27 81 640 1939",
    "referralCode": "COMMUNITYFIRST",
    "channel": "INSTAGRAM",
    "status": "ACTIVE"
  }
];
