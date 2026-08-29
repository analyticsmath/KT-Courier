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
    "email": "promoter.themba.du plessis1@ktcouriers.local",
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
    "email": "promoter.karabo.van der merwe5@ktcouriers.local",
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
  },
  {
    "id": "promo-011",
    "email": "promoter.mandla.ndlovu11@ktcouriers.local",
    "name": "Mandla Ndlovu",
    "phone": "+27 81 842 1191",
    "referralCode": "GOURMETSA",
    "channel": "FOOD_BLOG",
    "status": "ACTIVE"
  },
  {
    "id": "promo-012",
    "email": "promoter.themba.steyn12@ktcouriers.local",
    "name": "Themba Steyn",
    "phone": "+27 81 535 6359",
    "referralCode": "BRAAITIME",
    "channel": "CAMPUS_BRAND",
    "status": "ACTIVE"
  },
  {
    "id": "promo-013",
    "email": "promoter.jacques.dlamini13@ktcouriers.local",
    "name": "Jacques Dlamini",
    "phone": "+27 82 920 2444",
    "referralCode": "SPEEDYEXPRESS",
    "channel": "CAMPUS_BRAND",
    "status": "ACTIVE"
  },
  {
    "id": "promo-014",
    "email": "promoter.anisha.nel14@ktcouriers.local",
    "name": "Anisha Nel",
    "phone": "+27 81 497 1446",
    "referralCode": "METROCOURIER",
    "channel": "INSTAGRAM",
    "status": "ACTIVE"
  },
  {
    "id": "promo-015",
    "email": "promoter.neo.moyo15@ktcouriers.local",
    "name": "Neo Moyo",
    "phone": "+27 83 465 6364",
    "referralCode": "SUNSHINEDISPATCH",
    "channel": "CAMPUS_BRAND",
    "status": "ACTIVE"
  },
  {
    "id": "promo-016",
    "email": "promoter.bongani.visser16@ktcouriers.local",
    "name": "Bongani Visser",
    "phone": "+27 82 225 2199",
    "referralCode": "JHBVIBES16",
    "channel": "COMMUNITY",
    "status": "ACTIVE"
  },
  {
    "id": "promo-017",
    "email": "promoter.lebohang.patel17@ktcouriers.local",
    "name": "Lebohang Patel",
    "phone": "+27 84 976 9950",
    "referralCode": "SANDTONEATS17",
    "channel": "COMMUNITY",
    "status": "ACTIVE"
  },
  {
    "id": "promo-018",
    "email": "promoter.andile.daniels18@ktcouriers.local",
    "name": "Andile Daniels",
    "phone": "+27 81 319 5619",
    "referralCode": "JOZILIVING18",
    "channel": "CAMPUS_BRAND",
    "status": "ACTIVE"
  },
  {
    "id": "promo-019",
    "email": "promoter.anisha.govender19@ktcouriers.local",
    "name": "Anisha Govender",
    "phone": "+27 82 354 1204",
    "referralCode": "CAPETOWNDEALS19",
    "channel": "INSTAGRAM",
    "status": "ACTIVE"
  },
  {
    "id": "promo-020",
    "email": "promoter.bulelwa.matlala20@ktcouriers.local",
    "name": "Bulelwa Matlala",
    "phone": "+27 82 481 8705",
    "referralCode": "DURBANSPICE20",
    "channel": "FOOD_BLOG",
    "status": "ACTIVE"
  },
  {
    "id": "promo-021",
    "email": "promoter.marike.du randt21@ktcouriers.local",
    "name": "Marike Du Randt",
    "phone": "+27 82 999 4124",
    "referralCode": "HEALTHYZA21",
    "channel": "FOOD_BLOG",
    "status": "ACTIVE"
  },
  {
    "id": "promo-022",
    "email": "promoter.lindiwe.reddy22@ktcouriers.local",
    "name": "Lindiwe Reddy",
    "phone": "+27 82 409 8458",
    "referralCode": "FRESHDELIVERY22",
    "channel": "FOOD_BLOG",
    "status": "ACTIVE"
  },
  {
    "id": "promo-023",
    "email": "promoter.lebohang.zuma23@ktcouriers.local",
    "name": "Lebohang Zuma",
    "phone": "+27 81 810 6710",
    "referralCode": "SHOPLOCALZA23",
    "channel": "CAMPUS_BRAND",
    "status": "PENDING"
  },
  {
    "id": "promo-024",
    "email": "promoter.craig.snyman24@ktcouriers.local",
    "name": "Craig Snyman",
    "phone": "+27 83 704 1878",
    "referralCode": "CAMPUSKT24",
    "channel": "COMMUNITY",
    "status": "PENDING"
  },
  {
    "id": "promo-025",
    "email": "promoter.nomsa.moodley25@ktcouriers.local",
    "name": "Nomsa Moodley",
    "phone": "+27 81 389 5963",
    "referralCode": "COMMUNITYFIRST25",
    "channel": "INSTAGRAM",
    "status": "PENDING"
  }
];
