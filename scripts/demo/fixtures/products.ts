/**
 * KT Couriers — Curated Master Merchandise Library
 * Generated cleanly with zero bracket characters, zero forbidden tokens,
 * multi-image gallery definitions, and verified 100.0% uniqueness.
 */

export interface ProductTemplate {
  key: string;
  title: string;
  categoryRef: string;
  ptCode: string;
  brandName?: string;
  shortDescription: string;
  description: string;
  basePrice: number;
  condition: "NEW" | "REFURBISHED" | "RECONDITIONED" | "USED";
  sellingUnit: "EACH" | "FIXED_WEIGHT" | "VARIABLE_WEIGHT" | "VOLUME" | "LENGTH";
  inventoryTrackingMode: "TRACKED" | "UNTRACKED" | "MADE_TO_ORDER";
  imageKeys: string[];
  attributes: Record<string, string | number | boolean>;
}

export const DEMO_PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    "key": "PROD-HASS-AVOCADOS-4PK",
    "title": "Organic Hass Avocados 4 Pack",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Creamy ripe Hass avocados with rich nutty flavor and buttery texture.",
    "description": "Handpicked Hass avocados from sunny Limpopo orchards. Perfect for salads, guacamole or toasted sourdough breakfasts. High in monounsaturated fats and dietary potassium.",
    "basePrice": 48.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-AVOCADOS-1",
      "CMA-PROD-AVOCADOS-2",
      "CMA-PROD-AVOCADOS-3"
    ],
    "attributes": {
      "packSize": "4 Pack",
      "origin": "Limpopo"
    }
  },
  {
    "key": "PROD-GALA-APPLES-15KG",
    "title": "Crisp Royal Gala Apples 1.5 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Elgin Valley Orchards",
    "shortDescription": "Sweet aromatic apples with crisp thin skin and juicy texture.",
    "description": "Naturally sweet Royal Gala apples harvested in the cool Elgin Valley. Delicious for daily lunchbox snacking, baking into rustic crumbles or pairing with sharp farmhouse cheddar.",
    "basePrice": 38,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-APPLES-1",
      "CMA-PROD-APPLES-2",
      "CMA-PROD-APPLES-3"
    ],
    "attributes": {
      "weight": "1.5 kg",
      "origin": "Western Cape"
    }
  },
  {
    "key": "PROD-BANANAS-1KG",
    "title": "Sweet Cavendish Bananas 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Kiepersol Sun Produce",
    "shortDescription": "Plump yellow Cavendish bananas ripened naturally for daily energy.",
    "description": "Rich and wholesome Cavendish bananas grown in subtropical Mpumalanga soil. A nutritious source of potassium, vitamin B6 and dietary fibre for smoothies and breakfast bowls.",
    "basePrice": 24.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BANANAS-1",
      "CMA-PROD-BANANAS-2",
      "CMA-PROD-BANANAS-3"
    ],
    "attributes": {
      "weight": "1 kg",
      "origin": "Mpumalanga"
    }
  },
  {
    "key": "PROD-SPINACH-BUNCH",
    "title": "Farm Fresh English Spinach 350 g",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Ubuntu Valley Greens",
    "shortDescription": "Tender crisp dark green spinach leaves freshly washed and bunched.",
    "description": "Nutrient-packed green spinach leaves hand-harvested in early morning mist. Ideal for light garlic sautees, green breakfast smoothies, quiches and hearty dinner stews.",
    "basePrice": 19.9,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SPINACH-1",
      "CMA-PROD-SPINACH-2",
      "CMA-PROD-SPINACH-3"
    ],
    "attributes": {
      "weight": "350 g"
    }
  },
  {
    "key": "PROD-ROMA-TOMATOES-1KG",
    "title": "Vine Ripened Roma Tomatoes 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Letaba Valley",
    "shortDescription": "Meaty plum tomatoes with low acidity and deep rich tomato sweetness.",
    "description": "Thick-walled Roma tomatoes cultivated in rich lowveld sun. The quintessential base for slow-simmered marinara pasta sauces, roasted salsas and colorful lunch salads.",
    "basePrice": 29.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TOMATOES-1",
      "CMA-PROD-TOMATOES-2",
      "CMA-PROD-TOMATOES-3"
    ],
    "attributes": {
      "weight": "1 kg",
      "origin": "Limpopo"
    }
  },
  {
    "key": "PROD-ENGLISH-CUCUMBER",
    "title": "Crisp Seedless English Cucumber",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Hydro Greens",
    "shortDescription": "Cool crunchy seedless cucumber wrapped for freshness.",
    "description": "Hydroponically cultivated English cucumber with sweet delicate flesh and thin refreshing skin. Perfect for refreshing tzatziki dips, picnic sandwiches and summer salads.",
    "basePrice": 16.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CUCUMBER-1",
      "CMA-PROD-CUCUMBER-2",
      "CMA-PROD-CUCUMBER-3"
    ],
    "attributes": {
      "seedless": true
    }
  },
  {
    "key": "PROD-SWEET-POTATOES-2KG",
    "title": "Orange Flesh Sweet Potatoes 2 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Cape Root Farms",
    "shortDescription": "Naturally sweet vibrant orange sweet potatoes rich in beta carotene.",
    "description": "Earthy orange sweet potatoes harvested from fertile coastal soils. Roast them whole with coarse sea salt, mash with butter, or slice into crispy baked wedges for a wholesome dinner side.",
    "basePrice": 36,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SWEET-POTATO-1",
      "CMA-PROD-SWEET-POTATO-2",
      "CMA-PROD-SWEET-POTATO-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-RED-ONIONS-1KG",
    "title": "Sweet Mild Red Onions 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Kouga Valley Roots",
    "shortDescription": "Crisp vibrant red onions with pleasant mild sharpness.",
    "description": "Firm red onions with glossy purple-tinged skins. Excellent sliced raw in Greek village salads and burger platters, or gently caramelized for savory tarts and gravies.",
    "basePrice": 22,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-RED-ONIONS-1",
      "CMA-PROD-RED-ONIONS-2",
      "CMA-PROD-RED-ONIONS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-BABY-SPINACH-200G",
    "title": "Tender Baby Spinach Leaves 200 g",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Ubuntu Valley Greens",
    "shortDescription": "Young delicate spinach leaves triple-washed and ready to enjoy.",
    "description": "Plump baby spinach leaves selected for maximum tenderness and mild flavor. Ready to toss into raw salads, pasta dishes, wraps or breakfast omelettes without chopping.",
    "basePrice": 24,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BABY-SPINACH-1",
      "CMA-PROD-BABY-SPINACH-2",
      "CMA-PROD-BABY-SPINACH-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-SWEET-BELL-PEPPERS-3PK",
    "title": "Mixed Sweet Bell Peppers 3 Pack",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Hydro Greens",
    "shortDescription": "Trio of red, yellow and green bell peppers bursting with sweet crunch.",
    "description": "Vibrant combination of greenhouse sweet bell peppers. High in vitamin C and antioxidant carotenoids. Ideal for fajitas, vegetable stir-fries, roasting or raw crudite dipping.",
    "basePrice": 32.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BELL-PEPPERS-1",
      "CMA-PROD-BELL-PEPPERS-2",
      "CMA-PROD-BELL-PEPPERS-3"
    ],
    "attributes": {
      "packSize": "3 Pack"
    }
  },
  {
    "key": "PROD-CARROTS-1KG",
    "title": "Sweet Crunchy Baby Carrots 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Kouga Valley Roots",
    "shortDescription": "Tender sweet carrots with vibrant orange color and snappy crunch.",
    "description": "Soil-grown sweet carrots full of natural sweetness and vitamins. Perfect for roasting with thyme and butter, grating into slaw or slicing raw for children lunchboxes.",
    "basePrice": 18.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CARROTS-1",
      "CMA-PROD-CARROTS-2",
      "CMA-PROD-CARROTS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-LEMONS-1KG",
    "title": "Juicy Eureka Lemons 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Sunday River Valley",
    "shortDescription": "Bright yellow fragrant lemons with high juice content and zest.",
    "description": "Sun-ripened Eastern Cape Eureka lemons brimming with tart natural juice and fragrant citrus oils. Essential for seafood marinades, salad dressings, baking and morning warm water drinks.",
    "basePrice": 26,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LEMONS-1",
      "CMA-PROD-LEMONS-2",
      "CMA-PROD-LEMONS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-FREE-RANGE-EGGS-18",
    "title": "Farm Fresh Free Range Large Eggs 18 Pack",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Green Pastures Farm",
    "shortDescription": "Large free-range eggs with golden yolks from pasture-roaming hens.",
    "description": "Wholesome large brown eggs laid by cage-free hens foraging on open pastures. Golden rich yolks and firm egg whites ideal for morning poaching, baking cakes and fluffy scrambles.",
    "basePrice": 64,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-EGGS-1",
      "CMA-PROD-EGGS-2",
      "CMA-PROD-EGGS-3"
    ],
    "attributes": {
      "packSize": "18 Pack"
    }
  },
  {
    "key": "PROD-FULL-CREAM-MILK-2L",
    "title": "Fresh Full Cream Fresh Milk 2 L",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Dairy Co",
    "shortDescription": "Pasteurized homogenized full-cream fresh milk with 3.5 percent fat.",
    "description": "Creamy fresh milk from pasture-fed dairy herds. Cold-filtered and pasteurized for pure taste and wholesome morning nutrition with breakfast cereal, tea and artisan coffee.",
    "basePrice": 38.5,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MILK-1",
      "CMA-PROD-MILK-2",
      "CMA-PROD-MILK-3"
    ],
    "attributes": {
      "volume": "2 L"
    }
  },
  {
    "key": "PROD-GREEK-YOGHURT-1KG",
    "title": "Double Cream Plain Greek Style Yoghurt 1 kg",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Karoo Creamery",
    "shortDescription": "Thick velvety double cream plain yoghurt crafted with live cultures.",
    "description": "Luxuriously thick Greek-style yoghurt made with pure fresh cream and live active probiotic cultures. Unsweetened and versatile for granola bowls, marinades, dips and dessert baking.",
    "basePrice": 56,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-YOGHURT-1",
      "CMA-PROD-YOGHURT-2",
      "CMA-PROD-YOGHURT-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-CHEDDAR-BLOCK-400G",
    "title": "Aged Mature Cheddar Cheese Block 400 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Midlands Cheese Guild",
    "shortDescription": "Sharp 12-month aged cheddar cheese with crumbly crystalline texture.",
    "description": "Handcrafted in the KwaZulu-Natal Midlands using traditional cheesecloth aging methods. Offers a pronounced savory depth that elevates toasted sandwiches, cheese platters and savory bakes.",
    "basePrice": 78,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHEDDAR-1",
      "CMA-PROD-CHEDDAR-2",
      "CMA-PROD-CHEDDAR-3"
    ],
    "attributes": {
      "weight": "400 g"
    }
  },
  {
    "key": "PROD-SALTY-BUTTER-500G",
    "title": "Pure Farmhouse Salted Butter 500 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Karoo Creamery",
    "shortDescription": "Traditional churned butter with fine sea salt and rich yellow creaminess.",
    "description": "Slow-churned from fresh sweet cream with a hint of natural sea salt crystals. Spreads effortlessly over warm crusty bread, melts beautifully over pan-seared meats and enriches pastry baking.",
    "basePrice": 69.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BUTTER-1",
      "CMA-PROD-BUTTER-2",
      "CMA-PROD-BUTTER-3"
    ],
    "attributes": {
      "weight": "500 g"
    }
  },
  {
    "key": "PROD-PARMESAN-WEDGE-200G",
    "title": "Italian Style Hard Grating Cheese 200 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Midlands Cheese Guild",
    "shortDescription": "Hard aged grating cheese with nutty aroma and savoury umami bite.",
    "description": "Aged for 18 months to develop delicate crunchy protein crystals and intense savory depth. Grate finely over hot pasta bowls, risotto, Caesar salads and rich vegetable gratins.",
    "basePrice": 85,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PARMESAN-1",
      "CMA-PROD-PARMESAN-2",
      "CMA-PROD-PARMESAN-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-COTTAGE-CHEESE-250G",
    "title": "Smooth Low Fat Plain Cottage Cheese 250 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Dairy Co",
    "shortDescription": "Delicate high protein cottage cheese with silky smooth consistency.",
    "description": "Wholesome fresh cottage cheese packed with clean dairy protein and calcium. A versatile healthy spread on crisp grain crackers, sourdough toast or folded into baked cheesecakes and dips.",
    "basePrice": 32,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-COTTAGE-1",
      "CMA-PROD-COTTAGE-2",
      "CMA-PROD-COTTAGE-3"
    ],
    "attributes": {
      "weight": "250 g"
    }
  },
  {
    "key": "PROD-MOZZARELLA-BALLS-200G",
    "title": "Fior di Latte Fresh Mozzarella Balls 200 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Midlands Cheese Guild",
    "shortDescription": "Soft creamy fresh mozzarella immersed in mild brine whey.",
    "description": "Traditional Italian style fresh cow milk mozzarella with tender porcelain white texture and delicate milky sweetness. Delicious in Caprese salads with fresh basil and ripe tomatoes.",
    "basePrice": 48,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MOZZARELLA-1",
      "CMA-PROD-MOZZARELLA-2",
      "CMA-PROD-MOZZARELLA-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-EXTRA-VIRGIN-OLIVE-OIL-750ML",
    "title": "Cold Pressed Extra Virgin Olive Oil 750 ml",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Robertson Olive Estate",
    "shortDescription": "First cold press olive oil with fresh grassy notes and peppery finish.",
    "description": "Estate-bottled extra virgin olive oil pressed within hours of harvest from Frantoio, Coratina and Mission olives. Enhances raw salads, rustic focaccias, grilled vegetables and pasta sauces.",
    "basePrice": 155,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-OLIVE-OIL-1",
      "CMA-PROD-OLIVE-OIL-2",
      "CMA-PROD-OLIVE-OIL-3"
    ],
    "attributes": {
      "volume": "750 ml"
    }
  },
  {
    "key": "PROD-RAW-HONEY-500G",
    "title": "Pure Raw Wildflower Honey 500 g",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Fynbos Apiaries",
    "shortDescription": "Unfiltered pure honey rich with natural pollen and floral enzymes.",
    "description": "Harvested from wild indigenous coastal fynbos blooms. Never overheated or fine-filtered to preserve the natural pollen, delicate floral bouquet and soothing enzymes of raw honey.",
    "basePrice": 89,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HONEY-1",
      "CMA-PROD-HONEY-2",
      "CMA-PROD-HONEY-3"
    ],
    "attributes": {
      "weight": "500 g"
    }
  },
  {
    "key": "PROD-BASMATI-RICE-2KG",
    "title": "Long Grain Fragrant Basmati Rice 2 kg",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Harvest Crown",
    "shortDescription": "Aged long slender rice grains that cook fluffy and separate.",
    "description": "Naturally aged fragrant basmati rice grains that elongate to twice their length upon gentle steaming. Complements fragrant Durban curries, biryanis, grilled kebabs and stew dishes.",
    "basePrice": 68,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BASMATI-1",
      "CMA-PROD-BASMATI-2",
      "CMA-PROD-BASMATI-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-ROASTED-COFFEE-BEANS-1KG",
    "title": "African Blend Medium Dark Roast Coffee Beans 1 kg",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Bree Street Roasters",
    "shortDescription": "Whole bean Arabica blend with notes of dark cocoa and caramel.",
    "description": "Directly traded Ethiopian and Tanzanian Arabica beans drum-roasted in small batches. Produces an espresso with thick hazelnut crema, balanced acidity and deep lingering chocolate notes.",
    "basePrice": 285,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-COFFEE-BEANS-1",
      "CMA-PROD-COFFEE-BEANS-2",
      "CMA-PROD-COFFEE-BEANS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-ROOIBOS-TEA-80S",
    "title": "Organic Pure Cederberg Rooibos Tea 80 Teabags",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Sunbird Botanical",
    "shortDescription": "Naturally caffeine-free South African red tea rich in antioxidants.",
    "description": "Single-origin red rooibos cultivated in the pristine Cederberg mountains. Delivers a smooth amber infusion with warm woody honey notes. Naturally caffeine-free and soothing day or night.",
    "basePrice": 52,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ROOIBOS-1",
      "CMA-PROD-ROOIBOS-2",
      "CMA-PROD-ROOIBOS-3"
    ],
    "attributes": {
      "count": "80 Teabags"
    }
  },
  {
    "key": "PROD-ARTISAN-DARK-CHOCOLATE-80G",
    "title": "Single Origin 70 Percent Dark Chocolate Bar 80 g",
    "categoryRef": "CC-SNACKS",
    "ptCode": "GROCERIES",
    "brandName": "Cocoa Fair Cape",
    "shortDescription": "Stone-ground dark chocolate with notes of roasted hazelnut and berry.",
    "description": "Craft bean-to-bar dark chocolate prepared with organic cocoa beans and unrefined cane sugar. Conched for 72 hours for a silky melt and rich, non-bitter chocolate profile.",
    "basePrice": 46,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHOCOLATE-1",
      "CMA-PROD-CHOCOLATE-2",
      "CMA-PROD-CHOCOLATE-3"
    ],
    "attributes": {
      "weight": "80 g"
    }
  },
  {
    "key": "PROD-SPARKLING-MINERAL-WATER-750ML",
    "title": "Natural Sparkling Mineral Water Glass Bottle 750 ml",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Franschhoek Springs",
    "shortDescription": "Pure mountain aquifer sparkling water with fine natural effervescence.",
    "description": "Bottled at source in the Franschhoek mountain catchment. Naturally enriched with essential trace minerals and gentle crisp carbonation for dining tables and refreshing hydration.",
    "basePrice": 28,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-WATER-1",
      "CMA-PROD-WATER-2",
      "CMA-PROD-WATER-3"
    ],
    "attributes": {
      "volume": "750 ml"
    }
  },
  {
    "key": "PROD-ARTISAN-SOURDOUGH-LOAF",
    "title": "Slow Fermented Country Sourdough Batard 800 g",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Kloof Street Bakehouse",
    "shortDescription": "Crusty golden sourdough baked with stoneground unbleached wheat flour.",
    "description": "Naturally leavened over 36 hours with a wild mother culture and baked on stone hearths. Boasts an open airy crumb, pleasant mild tang, and a caramelized blistered golden crust.",
    "basePrice": 44,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SOURDOUGH-1",
      "CMA-PROD-SOURDOUGH-2",
      "CMA-PROD-SOURDOUGH-3"
    ],
    "attributes": {
      "weight": "800 g"
    }
  },
  {
    "key": "PROD-ORGANIC-OATS-1KG",
    "title": "Rolled Whole Grain Jumbo Oats 1 kg",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Harvest Crown",
    "shortDescription": "Wholesome slow-cooking rolled oats high in soluble beta-glucan fibre.",
    "description": "Thick-cut jumbo rolled oat flakes prepared from non-GMO South African oats. Creates comforting creamy morning porridge bowls and provides the ideal base for toasted nutty mueslis.",
    "basePrice": 42,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-OATS-1",
      "CMA-PROD-OATS-2",
      "CMA-PROD-OATS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-ROASTED-ALMONDS-300G",
    "title": "Dry Roasted Salted Whole Almonds 300 g",
    "categoryRef": "CC-SNACKS",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Crunchy oven roasted California almonds seasoned with Kalahari desert salt.",
    "description": "Premium grade whole almonds slow-roasted without added oils and tossed in pure mineral desert salt. A protein-rich snack packed with healthy dietary fats, vitamin E and magnesium.",
    "basePrice": 88,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ALMONDS-1",
      "CMA-PROD-ALMONDS-2",
      "CMA-PROD-ALMONDS-3"
    ],
    "attributes": {
      "weight": "300 g"
    }
  },
  {
    "key": "PROD-SMASH-BURGER-COMBO",
    "title": "Double Prime Beef Smash Burger and Crispy Chips",
    "categoryRef": "CC-BURGERS",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Two seared beef patties, cheddar, pickles and house sauce on brioche.",
    "description": "Two 100g prime beef patties smashed over high heat on a cast iron griddle for crispy caramelised edges. Topped with double mature cheddar, dill pickles, grilled onions and smoky relish.",
    "basePrice": 125,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BURGER-1",
      "CMA-PROD-BURGER-2",
      "CMA-PROD-BURGER-3"
    ],
    "attributes": {
      "mealType": "Burger Combo"
    }
  },
  {
    "key": "PROD-PERI-CHICKEN-MEAL",
    "title": "Flame Grilled Half Chicken with Seasoned Wedges",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Tender half chicken marinated in peri-peri spices with potato wedges.",
    "description": "Fresh chicken marinated for 24 hours in garlic, bird eye chili and lemon juice before flame-grilling over open coals. Served tender with crispy rosemary wedges and a tangy dipping pot.",
    "basePrice": 135,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-GRILLED-CHICKEN-1",
      "CMA-PROD-GRILLED-CHICKEN-2",
      "CMA-PROD-GRILLED-CHICKEN-3"
    ],
    "attributes": {
      "spice": "Medium"
    }
  },
  {
    "key": "PROD-MARGHERITA-PIZZA",
    "title": "Stonebaked Margherita Pizza 30 cm",
    "categoryRef": "CC-PIZZA",
    "ptCode": "FOOD_DINING",
    "brandName": "Bree Street Artisans",
    "shortDescription": "Classic thin crust pizza with San Marzano sauce, fior di latte and basil.",
    "description": "48-hour fermented dough stretched by hand and baked in a 400C stone oven. Finished with crushed Italian plum tomatoes, creamy fior di latte mozzarella and fresh sweet basil leaves.",
    "basePrice": 110,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-PIZZA-MARGHERITA-1",
      "CMA-PROD-PIZZA-MARGHERITA-2",
      "CMA-PROD-PIZZA-MARGHERITA-3"
    ],
    "attributes": {
      "size": "30 cm"
    }
  },
  {
    "key": "PROD-BUTTER-CHICKEN-CURRY",
    "title": "Creamy Butter Chicken Curry with Garlic Butter Naan",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Durban Spice Table",
    "shortDescription": "Tender tandoori chicken simmered in rich spiced tomato butter gravy.",
    "description": "Marinated chicken pieces cooked in a clay oven and simmered in a velvety sauce of pure cream, butter, fenugreek leaves and mild garam masala. Served with hot garlic naan bread.",
    "basePrice": 140,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BUTTER-CHICKEN-1",
      "CMA-PROD-BUTTER-CHICKEN-2",
      "CMA-PROD-BUTTER-CHICKEN-3"
    ],
    "attributes": {
      "includes": "Naan Bread"
    }
  },
  {
    "key": "PROD-TRADITIONAL-BEEF-STEW",
    "title": "Slow Braised Beef Stew with Steamed Dombolo",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Ubuntu Fresh Market Kitchen",
    "shortDescription": "Tender beef shank slow cooked with root vegetables and fluffy dumplings.",
    "description": "Comforting South African home-style stew made with prime beef cuts, carrots, potatoes and rich aromatic thyme gravy. Accompanied by fresh warm steamed dombolo dumplings.",
    "basePrice": 130,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BEEF-STEW-1",
      "CMA-PROD-BEEF-STEW-2",
      "CMA-PROD-BEEF-STEW-3"
    ],
    "attributes": {
      "slowCooked": true
    }
  },
  {
    "key": "PROD-CRISPY-CHICKEN-BURGER",
    "title": "Southern Buttermilk Fried Chicken Burger",
    "categoryRef": "CC-BURGERS",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Crisp buttermilk battered chicken breast, tangy slaw and spicy mayo.",
    "description": "Tender chicken breast steeped in seasoned buttermilk and fried to golden crunchy perfection. Layered with purple cabbage slaw, sliced gherkins and chipotle mayonnaise on brioche.",
    "basePrice": 118,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CHICKEN-BURGER-1",
      "CMA-PROD-CHICKEN-BURGER-2",
      "CMA-PROD-CHICKEN-BURGER-3"
    ],
    "attributes": {
      "fried": true
    }
  },
  {
    "key": "PROD-DIAVOLA-PEPPERONI-PIZZA",
    "title": "Spicy Pepperoni and Jalapeno Stonebaked Pizza 30 cm",
    "categoryRef": "CC-PIZZA",
    "ptCode": "FOOD_DINING",
    "brandName": "Maboneng Woodfire Pizza",
    "shortDescription": "Artisan woodfired pizza topped with Italian salami and pickled jalapeno.",
    "description": "Crisp thin stonebaked crust layered with crushed plum tomatoes, mozzarella, spicy cured beef salami, sliced pickled jalapeno peppers, fresh oregano and hot chili infused honey.",
    "basePrice": 138,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-PEPPERONI-PIZZA-1",
      "CMA-PROD-PEPPERONI-PIZZA-2",
      "CMA-PROD-PEPPERONI-PIZZA-3"
    ],
    "attributes": {
      "size": "30 cm"
    }
  },
  {
    "key": "PROD-LAMB-BUNNY-CHOW",
    "title": "Traditional Durban Quarter Mutton Bunny Chow",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Durban Spice Table",
    "shortDescription": "Hollowed fresh white loaf filled with fragrant slow-simmered lamb curry.",
    "description": "Iconic Durban street meal comprising a hollowed-out fresh loaf packed with tender mutton curry on the bone, soft melting potatoes, fresh coriander and a side of carrot salad.",
    "basePrice": 128,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BUNNY-CHOW-1",
      "CMA-PROD-BUNNY-CHOW-2",
      "CMA-PROD-BUNNY-CHOW-3"
    ],
    "attributes": {
      "authentic": "Durban"
    }
  },
  {
    "key": "PROD-BOEREWORS-ROLL-DELUXE",
    "title": "Charcoal Grilled Farm Boerewors Roll Deluxe",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Thick traditional spiced beef boerewors with sweet onion tomato relish.",
    "description": "Pure beef and pork coarse farm sausage grilled over red-hot charcoal coals. Tucked into a toasted sesame baguette and topped with warm slow-cooked tomato and onion sheba relish.",
    "basePrice": 75,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BOEREWORS-1",
      "CMA-PROD-BOEREWORS-2",
      "CMA-PROD-BOEREWORS-3"
    ],
    "attributes": {
      "grilled": "Charcoal"
    }
  },
  {
    "key": "PROD-ROAST-VEGETABLE-WRAP",
    "title": "Grilled Mediterranean Vegetable and Hummus Wrap",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Ubuntu Fresh Market Kitchen",
    "shortDescription": "Warm wholewheat wrap loaded with roasted peppers, feta and creamy hummus.",
    "description": "Flame-roasted zucchini, sweet bell peppers and red onion tossed in herb vinaigrette. Rolled in a toasted wholewheat flatbread with creamy chickpea hummus, wild rocket and Danish feta.",
    "basePrice": 86,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-VEG-WRAP-1",
      "CMA-PROD-VEG-WRAP-2",
      "CMA-PROD-VEG-WRAP-3"
    ],
    "attributes": {
      "vegetarian": true
    }
  },
  {
    "key": "PROD-PARACETAMOL-500MG-20TAB",
    "title": "Paracetamol 500 mg Pain Relief 20 Tablets",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "CarePlus Healthcare",
    "shortDescription": "Effective over the counter relief for mild pain, headache and fever.",
    "description": "Standard non-prescription paracetamol tablets for temporary relief of headaches, muscular aches, toothaches and body fever. Always read the package insert before use.",
    "basePrice": 28,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PARACETAMOL-1",
      "CMA-PROD-PARACETAMOL-2",
      "CMA-PROD-PARACETAMOL-3"
    ],
    "attributes": {
      "tabletCount": 20
    }
  },
  {
    "key": "PROD-VITAMIN-C-1000MG-20ELEV",
    "title": "Effervescent Vitamin C 1000 mg 20 Tablets",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "High-dose effervescent vitamin C with zinc for immune support.",
    "description": "Fast-dissolving orange flavored effervescent tablets providing 1000mg vitamin C and 10mg zinc. Formulated to support daily immune function and tissue repair during busy routines.",
    "basePrice": 79.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-VITAMIN-C-1",
      "CMA-PROD-VITAMIN-C-2",
      "CMA-PROD-VITAMIN-C-3"
    ],
    "attributes": {
      "tabletCount": 20
    }
  },
  {
    "key": "PROD-FAMILY-FIRST-AID-KIT",
    "title": "Complete Family First Aid Kit 65 Pieces",
    "categoryRef": "CC-FIRST-AID",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "SafeGuard Medical",
    "shortDescription": "Comprehensive medical first aid pouch for home, travel and motoring.",
    "description": "Sturdy zippered canvas pouch packed with sterile conforming bandages, antiseptic wipes, hypoallergenic adhesive plasters, stainless steel scissors, safety pins and CPR face shield.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-FIRST-AID-1",
      "CMA-PROD-FIRST-AID-2",
      "CMA-PROD-FIRST-AID-3"
    ],
    "attributes": {
      "pieces": 65
    }
  },
  {
    "key": "PROD-NATURAL-BODY-LOTION-400ML",
    "title": "Soothing Marula and Shea Body Lotion 400 ml",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Deeply moisturizing gentle daily body lotion for sensitive skin.",
    "description": "Formulated with cold-pressed South African marula oil, organic unrefined shea butter and calming chamomile extract. Fast-absorbing, fragrance-gentle and dermatologically tested.",
    "basePrice": 115,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BODY-LOTION-1",
      "CMA-PROD-BODY-LOTION-2",
      "CMA-PROD-BODY-LOTION-3"
    ],
    "attributes": {
      "volume": "400 ml"
    }
  },
  {
    "key": "PROD-SALINE-NASAL-SPRAY-50ML",
    "title": "Gentle Saline Nasal Spray 50 ml",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "CarePlus Healthcare",
    "shortDescription": "Sterile isotonic saline solution for clearing blocked nasal passages.",
    "description": "Natural sea salt nasal spray that washes away airborne irritants, dust and excess mucus. Non-medicated formula safe for regular daily use by adults and children over two years.",
    "basePrice": 48,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-NASAL-SPRAY-1",
      "CMA-PROD-NASAL-SPRAY-2",
      "CMA-PROD-NASAL-SPRAY-3"
    ],
    "attributes": {
      "volume": "50 ml"
    }
  },
  {
    "key": "PROD-DAILY-MULTIVITAMIN-60TAB",
    "title": "Complete Daily Adult Multivitamin 60 Tablets",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Comprehensive daily multivitamin with minerals and active antioxidants.",
    "description": "Balanced formulation supplying essential vitamins A, B complex, C, D3, E, iron and magnesium. Helps maintain energy levels, healthy metabolism and normal cognitive performance.",
    "basePrice": 145,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MULTIVITAMIN-1",
      "CMA-PROD-MULTIVITAMIN-2",
      "CMA-PROD-MULTIVITAMIN-3"
    ],
    "attributes": {
      "count": 60
    }
  },
  {
    "key": "PROD-ANTISEPTIC-LIQUID-500ML",
    "title": "Topical Antiseptic Disinfectant Liquid 500 ml",
    "categoryRef": "CC-FIRST-AID",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "SafeGuard Medical",
    "shortDescription": "Hospital-grade antiseptic liquid for minor cuts, grazes and bites.",
    "description": "Proven antiseptic concentrate for gentle wound cleansing and skin hygiene. Dilute with clean water to treat abrasions, minor burns, insect stings and domestic surface cleansing.",
    "basePrice": 65,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ANTISEPTIC-1",
      "CMA-PROD-ANTISEPTIC-2",
      "CMA-PROD-ANTISEPTIC-3"
    ],
    "attributes": {
      "volume": "500 ml"
    }
  },
  {
    "key": "PROD-NATURAL-LIP-BALM-15G",
    "title": "Hydrating Beeswax and Honey Lip Balm 15 g",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Nourishing pocket lip balm made with raw beeswax and sweet almond oil.",
    "description": "Protects chapped dry lips against harsh sun, dry highveld air and sea breeze. Enriched with botanical vitamin E and organic honey for long-lasting soothing hydration.",
    "basePrice": 38,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LIP-BALM-1",
      "CMA-PROD-LIP-BALM-2",
      "CMA-PROD-LIP-BALM-3"
    ],
    "attributes": {
      "weight": "15 g"
    }
  },
  {
    "key": "PROD-TWS-WIRELESS-EARBUDS",
    "title": "True Wireless Bluetooth Earbuds with Charging Case",
    "categoryRef": "CC-AUDIO",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Sound Labs",
    "shortDescription": "Compact Bluetooth 5.3 earbuds with 28 hour total playback time.",
    "description": "Ergonomic in-ear wireless earphones with 10mm dynamic drivers, environmental noise reduction microphones for crystal clear phone calls, IPX4 splash resistance and fast USB C charging.",
    "basePrice": 480,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-EARBUDS-1",
      "CMA-PROD-EARBUDS-2",
      "CMA-PROD-EARBUDS-3"
    ],
    "attributes": {
      "batteryHours": 28
    }
  },
  {
    "key": "PROD-GAN-65W-WALL-CHARGER",
    "title": "Compact GaN 65 Watt Dual USB C Fast Wall Charger",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit Pro Tech",
    "shortDescription": "Ultra-compact fast charger for laptops, tablets and smartphones.",
    "description": "Gallium Nitride technology enables a 65W power delivery brick half the size of standard laptop adapters. Features dual USB C ports and intelligent power allocation with safety thermal control.",
    "basePrice": 499,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHARGER-1",
      "CMA-PROD-CHARGER-2",
      "CMA-PROD-CHARGER-3"
    ],
    "attributes": {
      "wattage": "65 W"
    }
  },
  {
    "key": "PROD-BRAIDED-USBC-CABLE-2M",
    "title": "Heavy Duty Braided USB C to USB C Cable 2 m",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit Pro Tech",
    "shortDescription": "Reinforced nylon braided 100W charging and high speed data cable.",
    "description": "Tangle-free double-braided nylon jacket with aluminium alloy connector housings tested to 15000 bends. Supports up to 100W USB Power Delivery for rapid charging of phones and laptops.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CABLE-1",
      "CMA-PROD-CABLE-2",
      "CMA-PROD-CABLE-3"
    ],
    "attributes": {
      "length": "2 m"
    }
  },
  {
    "key": "PROD-POWERBANK-20000MAH",
    "title": "High Capacity 20000 mAh Fast Charge Power Bank",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Sound Labs",
    "shortDescription": "Slim portable backup battery with digital battery level display.",
    "description": "High-density lithium polymer battery capable of charging modern smartphones 4 to 5 times. Equipped with 22.5W fast output, USB C power delivery and an accurate LED percentage readout.",
    "basePrice": 580,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-POWERBANK-1",
      "CMA-PROD-POWERBANK-2",
      "CMA-PROD-POWERBANK-3"
    ],
    "attributes": {
      "capacity": "20000 mAh"
    }
  },
  {
    "key": "PROD-BLUETOOTH-SPEAKER-PORTABLE",
    "title": "Rugged Waterproof Bluetooth Speaker 16 Watt",
    "categoryRef": "CC-AUDIO",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Sound Labs",
    "shortDescription": "Outdoor portable speaker with punchy bass and 15 hour battery life.",
    "description": "IPX7 waterproof rated speaker engineered for braais, camping and travel. Dual passive radiators deliver deep resonant bass, while the shock-absorbent silicone casing resists drops and dust.",
    "basePrice": 650,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SPEAKER-1",
      "CMA-PROD-SPEAKER-2",
      "CMA-PROD-SPEAKER-3"
    ],
    "attributes": {
      "waterRating": "IPX7"
    }
  },
  {
    "key": "PROD-LAPTOP-STAND-ALUMINIUM",
    "title": "Ergonomic Foldable Aluminium Laptop Stand",
    "categoryRef": "CC-ELECTRONICS",
    "ptCode": "ELECTRONICS",
    "brandName": "Silicon Cape Tech",
    "shortDescription": "Adjustable ventilated aluminium desk riser for laptops up to 16 inch.",
    "description": "Precision machined anodized aluminium alloy stand with 6 adjustable angle heights. Improves typing posture and optimizes notebook cooling airflow. Folds flat into included travel sleeve.",
    "basePrice": 340,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-STAND-1",
      "CMA-PROD-STAND-2",
      "CMA-PROD-STAND-3"
    ],
    "attributes": {
      "material": "Aluminium"
    }
  },
  {
    "key": "PROD-WIRELESS-CHARGING-PAD",
    "title": "Fast Magnetic 15 Watt Qi Wireless Charging Pad",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit Pro Tech",
    "shortDescription": "Slim aluminium wireless charging disc with LED status indicator.",
    "description": "Sleek glass and aluminium wireless charging plate supporting up to 15W Qi fast charging. Foreign object detection and temperature protection ensure safe overnight phone replenishment.",
    "basePrice": 260,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PAD-1",
      "CMA-PROD-PAD-2",
      "CMA-PROD-PAD-3"
    ],
    "attributes": {
      "wattage": "15 W"
    }
  },
  {
    "key": "PROD-DESK-MAT-LEATHERETTE",
    "title": "Waterproof Dual Sided Desk Mat 80 by 40 cm",
    "categoryRef": "CC-ELECTRONICS",
    "ptCode": "ELECTRONICS",
    "brandName": "Silicon Cape Tech",
    "shortDescription": "Large protective desk blotter with smooth mouse tracking surface.",
    "description": "Durable PU leatherette workspace mat that shields wooden desks from scratches, beverage spills and heat. Easy to wipe clean with a damp cloth and reversible with contrasting accent color.",
    "basePrice": 220,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DESK-MAT-1",
      "CMA-PROD-DESK-MAT-2",
      "CMA-PROD-DESK-MAT-3"
    ],
    "attributes": {
      "dimensions": "80x40 cm"
    }
  },
  {
    "key": "PROD-COTTON-CREW-TEE-BLACK",
    "title": "Heavyweight 220 gsm Carded Cotton Crew T Shirt",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Urban Thread Co",
    "shortDescription": "Durable boxy cut crewneck t shirt knitted from combed South African cotton.",
    "description": "Crafted from pre-shrunk 220gsm heavyweight cotton for structured drape that retains its shape wash after wash. Features double-stitched hems, seamless collar ribbing and relaxed unisex fit.",
    "basePrice": 280,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TEE-BLACK-1",
      "CMA-PROD-TEE-BLACK-2",
      "CMA-PROD-TEE-BLACK-3"
    ],
    "attributes": {
      "material": "100 percent Cotton"
    }
  },
  {
    "key": "PROD-LEATHER-BIFOLD-WALLET",
    "title": "Handcrafted Bovine Leather Bifold Card Wallet",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Veld Leather Goods",
    "shortDescription": "Slim vegetable-tanned leather wallet with 8 card slots and cash sleeve.",
    "description": "Precision stitched using full-grain South African bovine leather that develops a warm characterful patina over time. Compact profile holds 8 cards, folded banknotes and receipts securely.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-WALLET-1",
      "CMA-PROD-WALLET-2",
      "CMA-PROD-WALLET-3"
    ],
    "attributes": {
      "material": "Leather"
    }
  },
  {
    "key": "PROD-CANVAS-TOTE-BAG",
    "title": "Reinforced 16 oz Cotton Canvas Everyday Tote Bag",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Urban Thread Co",
    "shortDescription": "Spacious heavy-duty canvas shoulder tote with inner zip compartment.",
    "description": "Built from resilient 16oz natural cotton duck canvas with reinforced shoulder straps and flat base. Includes a secure internal zippered pocket for keys, wallet and smartphone.",
    "basePrice": 240,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TOTE-1",
      "CMA-PROD-TOTE-2",
      "CMA-PROD-TOTE-3"
    ],
    "attributes": {
      "material": "Canvas"
    }
  },
  {
    "key": "PROD-LINEN-BUTTON-DOWN-SHIRT",
    "title": "Relaxed Pure Flax Linen Long Sleeve Shirt",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Protea Casualwear",
    "shortDescription": "Breathable washed linen shirt designed for casual coastal elegance.",
    "description": "Woven from 100 percent natural European flax yarn that becomes softer with every wash cycle. Features a casual spread collar, mother-of-pearl buttons and relaxed curved hem.",
    "basePrice": 590,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LINEN-SHIRT-1",
      "CMA-PROD-LINEN-SHIRT-2",
      "CMA-PROD-LINEN-SHIRT-3"
    ],
    "attributes": {
      "material": "100 percent Linen"
    }
  },
  {
    "key": "PROD-TRAIL-RUNNING-SNEAKERS",
    "title": "All Terrain Lightweight Trail Running Shoes",
    "categoryRef": "CC-FOOTWEAR",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Table Mountain Apparel",
    "shortDescription": "Cushioned athletic sneakers with aggressive multi-directional rubber grip.",
    "description": "Engineered for mountain trails and urban pavements alike. Breathable ripstop mesh upper, responsive EVA midsole foam and rugged lugged outsole providing reliable traction on loose gravel.",
    "basePrice": 1150,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SNEAKERS-1",
      "CMA-PROD-SNEAKERS-2",
      "CMA-PROD-SNEAKERS-3"
    ],
    "attributes": {
      "footwear": "Trail"
    }
  },
  {
    "key": "PROD-LEATHER-WEEKENDER-DUFFEL",
    "title": "Heritage Full Grain Leather Travel Duffel Bag",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Veld Leather Goods",
    "shortDescription": "Generous 45 litre cabin duffel with brass hardware and padded strap.",
    "description": "Handmade by master artisans with full-grain pull-up leather, solid antiqued brass buckles and reinforced base studs. Features a roomy cotton twill interior and dedicated footwear compartment.",
    "basePrice": 2200,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DUFFEL-1",
      "CMA-PROD-DUFFEL-2",
      "CMA-PROD-DUFFEL-3"
    ],
    "attributes": {
      "capacity": "45 L"
    }
  },
  {
    "key": "PROD-COTTON-HOODIE-GREY",
    "title": "Heavyweight Fleece Pullover Hoodie 380 gsm",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Urban Thread Co",
    "shortDescription": "Plush brushed fleece hoodie with double layered hood and kangaroo pocket.",
    "description": "Warm and substantial 380gsm cotton fleece pullover with snug ribbed cuffs and waist. Engineered for chilly highveld winter mornings and relaxed evening lounging.",
    "basePrice": 520,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HOODIE-1",
      "CMA-PROD-HOODIE-2",
      "CMA-PROD-HOODIE-3"
    ],
    "attributes": {
      "weight": "380 gsm"
    }
  },
  {
    "key": "PROD-POLARIZED-SUNGLASSES",
    "title": "Classic Acetate Polarized Sunglasses UV400",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Protea Casualwear",
    "shortDescription": "Handcrafted tortoiseshell cellulose acetate frames with glare reduction.",
    "description": "Timeless unisex silhouette fitted with category 3 polarized TAC lenses offering 100 percent UV400 protection against harsh African sun. Includes microfiber cleaning cloth and hard travel case.",
    "basePrice": 460,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SUNGLASSES-1",
      "CMA-PROD-SUNGLASSES-2",
      "CMA-PROD-SUNGLASSES-3"
    ],
    "attributes": {
      "uvRating": "UV400"
    }
  },
  {
    "key": "PROD-STONEWARE-DINNER-SET-12PC",
    "title": "Artisan Matte Glazed Stoneware Dinner Set 12 Piece",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Karoo Clay Homeware",
    "shortDescription": "Complete tableware set for 4 settings in warm natural charcoal glaze.",
    "description": "Fired at high temperatures for chip-resistant daily durability. Includes 4 dinner plates, 4 side plates and 4 deep pasta bowls. Microwave and dishwasher safe with handcrafted organic rims.",
    "basePrice": 890,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DINNER-SET-1",
      "CMA-PROD-DINNER-SET-2",
      "CMA-PROD-DINNER-SET-3"
    ],
    "attributes": {
      "pieces": 12
    }
  },
  {
    "key": "PROD-CAST-IRON-SKILLET-26CM",
    "title": "Pre Seasoned Heavy Duty Cast Iron Skillet 26 cm",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Baobab Kitchen Supplies",
    "shortDescription": "Classic heavy-duty cast iron pan with dual pour spouts and assist handle.",
    "description": "Pre-seasoned with natural plant oils for a chemical-free cooking surface with superior heat retention. Safe for gas stovetops, ovens, induction plates and outdoor open braai fires.",
    "basePrice": 460,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SKILLET-1",
      "CMA-PROD-SKILLET-2",
      "CMA-PROD-SKILLET-3"
    ],
    "attributes": {
      "diameter": "26 cm"
    }
  },
  {
    "key": "PROD-WOVEN-COTTON-THROW",
    "title": "Handwoven Textured Cotton Bed Throw 130 by 180 cm",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Soft breathable cotton blanket with knotted fringe edge accents.",
    "description": "Woven on traditional wooden looms from pure unbleached cotton yarns. Drapes effortlessly across sofas or the foot of a bed for lightweight warmth and rustic textural charm.",
    "basePrice": 380,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-THROW-1",
      "CMA-PROD-THROW-2",
      "CMA-PROD-THROW-3"
    ],
    "attributes": {
      "dimensions": "130x180 cm"
    }
  },
  {
    "key": "PROD-CHEF-KNIFE-20CM",
    "title": "German Stainless Steel 8 Inch Chef Knife",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Baobab Kitchen Supplies",
    "shortDescription": "Full-tang forged multipurpose kitchen knife with pakkawood handle.",
    "description": "Precision balanced blade forged from high carbon German stainless steel and ice-hardened to 56 HRC. Glides through meats, tough root vegetables and fine herbs with effortless control.",
    "basePrice": 540,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-KNIFE-1",
      "CMA-PROD-KNIFE-2",
      "CMA-PROD-KNIFE-3"
    ],
    "attributes": {
      "bladeLength": "20 cm"
    }
  },
  {
    "key": "PROD-CERAMIC-MUG-SET-4PC",
    "title": "Handmade Speckled Ceramic Coffee Mugs 4 Pack",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Karoo Clay Homeware",
    "shortDescription": "Generous 350 ml tactile ceramic cups with comfortable ear handles.",
    "description": "Hand-thrown stoneware mugs glazed in oatmeal with natural iron speckles. Ergonomically shaped to sit cozily in cupped hands during morning coffees, herbal teas and hot chocolates.",
    "basePrice": 310,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MUGS-1",
      "CMA-PROD-MUGS-2",
      "CMA-PROD-MUGS-3"
    ],
    "attributes": {
      "packSize": "4 Pack"
    }
  },
  {
    "key": "PROD-WOVEN-STORAGE-BASKET",
    "title": "Natural Ilala Palm Storage Basket with Lid",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Handwoven indigenous palm laundry and organizing hamper.",
    "description": "Intricately coiled and woven by rural craft cooperatives using sustainable wild ilala palm fronds. Provides sturdy and decorative concealed storage for blankets, toys or laundry.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BASKET-1",
      "CMA-PROD-BASKET-2",
      "CMA-PROD-BASKET-3"
    ],
    "attributes": {
      "material": "Palm"
    }
  },
  {
    "key": "PROD-HARDCOVER-DOT-GRID-JOURNAL",
    "title": "A5 Hardcover Dot Grid Notebook 192 Pages",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Longmarket Paper and Print",
    "shortDescription": "Archival 120 gsm acid free paper with ribbon bookmark and elastic band.",
    "description": "Elegantly bound hardcover journal engineered for bullet journaling, sketching and fountain pens without ink bleed-through. Opens completely flat at 180 degrees with expandable back pocket.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-JOURNAL-1",
      "CMA-PROD-JOURNAL-2",
      "CMA-PROD-JOURNAL-3"
    ],
    "attributes": {
      "pages": 192
    }
  },
  {
    "key": "PROD-FOUNTAIN-PEN-BRASS",
    "title": "Solid Machined Brass Pocket Fountain Pen Fine Nib",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Longmarket Paper and Print",
    "shortDescription": "Heavyweight brass writing instrument with smooth iridium tip.",
    "description": "Machined from solid brass that oxidizes to an individual vintage luster. Perfectly balanced when cap is posted, using standard international ink cartridges or bottled ink converter.",
    "basePrice": 480,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PEN-1",
      "CMA-PROD-PEN-2",
      "CMA-PROD-PEN-3"
    ],
    "attributes": {
      "nib": "Fine"
    }
  },
  {
    "key": "PROD-CAR-WASH-SHAMPOO-2L",
    "title": "Foaming pH Balanced Car Wash Shampoo 2 L",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "MotorWorks Essentials",
    "shortDescription": "High-lubricity car cleaning concentrate with carnauba wax gloss.",
    "description": "Thick suds lift dirt, road grime and bug splatter safely away from vehicle paintwork without stripping protective sealant coats. Leaves a sparkling water-beading carnauba shine.",
    "basePrice": 140,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CAR-SHAMPOO-1",
      "CMA-PROD-CAR-SHAMPOO-2",
      "CMA-PROD-CAR-SHAMPOO-3"
    ],
    "attributes": {
      "volume": "2 L"
    }
  },
  {
    "key": "PROD-TYRE-INFLATOR-12V",
    "title": "Digital 12V Portable Auto Tyre Inflator Pump",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "Highveld Auto Spares",
    "shortDescription": "Compact vehicle compressor with automatic pressure shut-off.",
    "description": "Plugs directly into vehicle 12V cigarette lighter sockets to rapidly inflate car tyres, bicycles and sports balls. Features a bright backlit digital PSI display and integrated LED work light.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-INFLATOR-1",
      "CMA-PROD-INFLATOR-2",
      "CMA-PROD-INFLATOR-3"
    ],
    "attributes": {
      "power": "12 V"
    }
  },
  {
    "key": "PROD-CHOCOLATE-TRUFFLE-CAKE-20CM",
    "title": "Decadent Dark Chocolate Truffle Layer Cake 20 cm",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Velvet Crumb Cake Studio",
    "shortDescription": "Triple-layer rich chocolate sponge layered with Belgian chocolate ganache.",
    "description": "Moist chocolate sponge filled and draped in 70 percent Belgian dark chocolate ganache, crowned with hand-rolled chocolate truffles and cocoa nibs. Serves 10 to 12 generous slices.",
    "basePrice": 380,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CHOCOLATE-CAKE-1",
      "CMA-PROD-CHOCOLATE-CAKE-2",
      "CMA-PROD-CHOCOLATE-CAKE-3"
    ],
    "attributes": {
      "diameter": "20 cm"
    }
  },
  {
    "key": "PROD-LEMON-MERINGUE-TART-6PK",
    "title": "Individual Lemon Meringue Butter Tarts 6 Pack",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Sweet Meadow Patisserie",
    "shortDescription": "Crisp shortcrust pastry shells with zesty lemon curd and toasted meringue.",
    "description": "Handcrafted individual tartlets filled with tart freshly squeezed lemon curd, topped with swirls of glossy Italian meringue and torched to golden perfection for afternoon tea.",
    "basePrice": 190,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-MERINGUE-1",
      "CMA-PROD-MERINGUE-2",
      "CMA-PROD-MERINGUE-3"
    ],
    "attributes": {
      "packSize": "6 Pack"
    }
  },
  {
    "key": "PROD-FYNBOS-BOUQUET-MEDIUM",
    "title": "Seasonal Indigenous Cape Fynbos Bouquet",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Willow and Stem Florist",
    "shortDescription": "Hand-tied floral arrangement featuring king proteas, pincushions and fynbos.",
    "description": "Artisan hand-tied bouquet highlighting iconic South African botanical heritage. Features pink king proteas, vibrant yellow pincushions, wax flowers and fragrant silver tree foliage.",
    "basePrice": 320,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BOUQUET-1",
      "CMA-PROD-BOUQUET-2",
      "CMA-PROD-BOUQUET-3"
    ],
    "attributes": {
      "indigenous": true
    }
  },
  {
    "key": "PROD-POTTED-MONSTERA-PLANT",
    "title": "Lush Potted Monstera Deliciosa in Ceramic Planter",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Jacaranda Floral Design",
    "shortDescription": "Established Swiss cheese houseplant in modern 18 cm matte pot.",
    "description": "Thriving tropical foliage plant with distinct fenestrated glossy green leaves. Shipped rooted in well-draining soil inside an 18cm white matte ceramic planter. Easy indoor care.",
    "basePrice": 280,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MONSTERA-1",
      "CMA-PROD-MONSTERA-2",
      "CMA-PROD-MONSTERA-3"
    ],
    "attributes": {
      "potSize": "18 cm"
    }
  },
  {
    "key": "PROD-ADULT-DOG-FOOD-8KG",
    "title": "Grain Free Free Range Beef Adult Dog Food 8 kg",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Paw and Pantry Pet Supplies",
    "shortDescription": "High-protein natural dry dog kibble with prebiotics and omega oils.",
    "description": "Formulated for optimal canine digestive health and shiny coat vitality. Prepared with real free-range beef, sweet potatoes, peas and flaxseed oil without artificial colorants or grain fillers.",
    "basePrice": 485,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DOG-FOOD-1",
      "CMA-PROD-DOG-FOOD-2",
      "CMA-PROD-DOG-FOOD-3"
    ],
    "attributes": {
      "weight": "8 kg"
    }
  },
  {
    "key": "PROD-SALMON-CAT-BISCUITS-2KG",
    "title": "Atlantic Salmon and Rice Complete Adult Cat Kibble 2 kg",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Cape Pet Nutrition",
    "shortDescription": "Nutrient-rich balanced cat food for digestive and urinary tract health.",
    "description": "Rich in real Atlantic salmon protein, taurine for clear vision and cranberry extract for urinary support. Crunchy bite-sized biscuits help control dental tartar buildup.",
    "basePrice": 220,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CAT-FOOD-1",
      "CMA-PROD-CAT-FOOD-2",
      "CMA-PROD-CAT-FOOD-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-BUTTERNUT-2KG",
    "title": "Fresh Sweet Butternut Squash 2 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Naturally sweet golden butternut squash with dense smooth flesh.",
    "description": "Locally harvested butternut squash ideal for roasting whole with brown butter, blending into velvety autumn soups or puréeing for wholesome baby meals.",
    "basePrice": 28,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BUTTERNUT-1",
      "CMA-PROD-BUTTERNUT-2",
      "CMA-PROD-BUTTERNUT-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-MUSHROOMS-BROWN-250G",
    "title": "Whole Brown Portabellini Mushrooms 250 g",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Hydro Greens",
    "shortDescription": "Earthy firm portabellini mushrooms freshly packed in breathable punnet.",
    "description": "Rich umami-packed whole brown mushrooms perfect for creamy garlic sauces, braai skewers, risotto dishes and morning breakfast skillets.",
    "basePrice": 27.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MUSHROOMS-1",
      "CMA-PROD-MUSHROOMS-2",
      "CMA-PROD-MUSHROOMS-3"
    ],
    "attributes": {
      "weight": "250 g"
    }
  },
  {
    "key": "PROD-GOUDA-CHEESE-400G",
    "title": "Traditional Mild Farmhouse Gouda Cheese 400 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Karoo Creamery",
    "shortDescription": "Creamy golden Dutch style Gouda with smooth buttery texture.",
    "description": "Natural cow milk cheese aged for 3 months to develop a sweet mellow flavor. Melts evenly over toasted breads, homemade pizzas and macaroni cheese bakes.",
    "basePrice": 72,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-GOUDA-1",
      "CMA-PROD-GOUDA-2",
      "CMA-PROD-GOUDA-3"
    ],
    "attributes": {
      "weight": "400 g"
    }
  },
  {
    "key": "PROD-ALMOND-MILK-1L",
    "title": "Unsweetened Plant Based Almond Milk 1 L",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Sun Valley Botanicals",
    "shortDescription": "Smooth creamy dairy-free almond milk fortified with calcium and vitamins.",
    "description": "Blended from lightly roasted almonds and pure mountain water. Completely lactose-free with zero added sugar. Excellent for lattes, matcha and morning granola bowls.",
    "basePrice": 39,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ALMOND-MILK-1",
      "CMA-PROD-ALMOND-MILK-2",
      "CMA-PROD-ALMOND-MILK-3"
    ],
    "attributes": {
      "volume": "1 L"
    }
  },
  {
    "key": "PROD-CANOLA-OIL-2L",
    "title": "Pure GMO Free Cold Filtered Canola Cooking Oil 2 L",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Harvest Crown",
    "shortDescription": "Neutral high smoke point cooking oil rich in plant omega 3.",
    "description": "Locally pressed non-GMO canola oil ideal for everyday frying, baking and salad dressings. Light clean taste with heart-healthy monounsaturated fatty acids.",
    "basePrice": 62,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CANOLA-OIL-1",
      "CMA-PROD-CANOLA-OIL-2",
      "CMA-PROD-CANOLA-OIL-3"
    ],
    "attributes": {
      "volume": "2 L"
    }
  },
  {
    "key": "PROD-PEANUT-BUTTER-400G",
    "title": "All Natural 100 Percent Crunchy Peanut Butter 400 g",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Ubuntu Valley Greens",
    "shortDescription": "Pure dry roasted peanuts stone ground with sea salt and no palm oil.",
    "description": "Wholesome crunchy peanut butter made purely with dry roasted groundnuts and a pinch of salt. Never contains hydrogenated fats, emulsifiers or added sugars.",
    "basePrice": 45,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PEANUT-BUTTER-1",
      "CMA-PROD-PEANUT-BUTTER-2",
      "CMA-PROD-PEANUT-BUTTER-3"
    ],
    "attributes": {
      "weight": "400 g"
    }
  },
  {
    "key": "PROD-DRIED-MANGO-200G",
    "title": "Sun Dried Soft Chewy Mango Strips 200 g",
    "categoryRef": "CC-SNACKS",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Naturally sweet preservative free dried mango slices from Hoedspruit.",
    "description": "Tree-ripened Tommy Atkins mangoes gently dried to lock in tropical sweetness, vibrant color and vitamin A. Wholesome lunchbox and trail energy snack.",
    "basePrice": 58,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DRIED-MANGO-1",
      "CMA-PROD-DRIED-MANGO-2",
      "CMA-PROD-DRIED-MANGO-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-ROOIBOS-CHAI-20S",
    "title": "Spiced Rooibos Chai Pyramid Infusions 20 Bags",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Sunbird Botanical",
    "shortDescription": "Indigenous rooibos blended with cardamon, cinnamon and fresh ginger.",
    "description": "Aromatic caffeine-free warming tea blend crafted with pure whole spices and organic red rooibos. Enjoy black with honey or brewed with warm milk as a comforting chai latte.",
    "basePrice": 48,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ROOIBOS-CHAI-1",
      "CMA-PROD-ROOIBOS-CHAI-2",
      "CMA-PROD-ROOIBOS-CHAI-3"
    ],
    "attributes": {
      "count": "20 Bags"
    }
  },
  {
    "key": "PROD-BBQ-BEEF-RIBS-MEAL",
    "title": "Slow Smoked BBQ Beef Short Ribs with Corn on Cob",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Tender fall-off-the-bone smoked beef ribs basted in sticky BBQ glaze.",
    "description": "Hickory-smoked for 6 hours until meltingly tender. Served with sweet buttered sweetcorn cobettes and crunchy purple cabbage slaw.",
    "basePrice": 185,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BEEF-RIBS-1",
      "CMA-PROD-BEEF-RIBS-2",
      "CMA-PROD-BEEF-RIBS-3"
    ],
    "attributes": {
      "smokedHours": 6
    }
  },
  {
    "key": "PROD-FOUR-CHEESE-PIZZA",
    "title": "Quattro Formaggi Woodfired Artisan Pizza 30 cm",
    "categoryRef": "CC-PIZZA",
    "ptCode": "FOOD_DINING",
    "brandName": "Bree Street Artisans",
    "shortDescription": "White stonebaked pizza with mozzarella, gorgonzola, parmesan and fontina.",
    "description": "Crisp crust brushed with garlic olive oil and topped with four melting artisan cheeses, fresh thyme leaves and cracked black pepper.",
    "basePrice": 145,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-FOUR-CHEESE-PIZZA-1",
      "CMA-PROD-FOUR-CHEESE-PIZZA-2",
      "CMA-PROD-FOUR-CHEESE-PIZZA-3"
    ],
    "attributes": {
      "size": "30 cm"
    }
  },
  {
    "key": "PROD-VEGGIE-BURGER-DELUXE",
    "title": "Crispy Black Bean and Quinoa Plant Burger",
    "categoryRef": "CC-BURGERS",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Handcrafted savory bean and roasted sweet potato patty on toasted bun.",
    "description": "Packed with wholesome black beans, organic quinoa, roasted corn and smoked paprika. Topped with fresh avocado slices and vegan chipotle aioli.",
    "basePrice": 112,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-VEGGIE-BURGER-1",
      "CMA-PROD-VEGGIE-BURGER-2",
      "CMA-PROD-VEGGIE-BURGER-3"
    ],
    "attributes": {
      "plantBased": true
    }
  },
  {
    "key": "PROD-CHICKEN-TIKKA-MASALA",
    "title": "Flame Seared Chicken Tikka Masala with Jeera Rice",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Durban Spice Table",
    "shortDescription": "Charred tandoori chicken chunks in rich aromatic fenugreek sauce.",
    "description": "Marinated in yoghurt and roasted spices, then simmered in a spiced tomato onion gravy with fresh green chilies and cream. Served with fragrant cumin rice.",
    "basePrice": 138,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CHICKEN-TIKKA-1",
      "CMA-PROD-CHICKEN-TIKKA-2",
      "CMA-PROD-CHICKEN-TIKKA-3"
    ],
    "attributes": {
      "includes": "Jeera Rice"
    }
  },
  {
    "key": "PROD-CALAMARI-FRITTERS",
    "title": "Crispy Spiced Salt and Pepper Calamari Strips",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Flash fried tender ocean calamari with lemon garlic tartare dip.",
    "description": "Tender squid tubes dusted in seasoned flour, flash-fried until crisp and served with fresh lemon wedges, herb salt and homemade creamy tartare dip.",
    "basePrice": 98,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CALAMARI-1",
      "CMA-PROD-CALAMARI-2",
      "CMA-PROD-CALAMARI-3"
    ],
    "attributes": {
      "seafood": true
    }
  },
  {
    "key": "PROD-PULLED-BEEF-SANDWICH",
    "title": "Slow Roasted Pulled Beef Brisket Ciabatta",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Ubuntu Fresh Market Kitchen",
    "shortDescription": "Tender shredded beef brisket with melted provolone and onion relish.",
    "description": "12-hour braised beef brisket piled high on a toasted artisan ciabatta with melted provolone cheese, rocket and tangy caramelized onion jam.",
    "basePrice": 115,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-PULLED-BEEF-1",
      "CMA-PROD-PULLED-BEEF-2",
      "CMA-PROD-PULLED-BEEF-3"
    ],
    "attributes": {
      "slowCooked": true
    }
  },
  {
    "key": "PROD-ALMOND-CROISSANT-2PK",
    "title": "Double Baked French Butter Almond Croissants 2 Pack",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Kloof Street Bakehouse",
    "shortDescription": "Flaky butter croissants filled with creamy almond frangipane paste.",
    "description": "Handcrafted laminate pastry double-baked with velvety vanilla almond cream, topped with toasted sliced almonds and dusted with fine icing sugar.",
    "basePrice": 76,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-ALMOND-CROISSANT-1",
      "CMA-PROD-ALMOND-CROISSANT-2",
      "CMA-PROD-ALMOND-CROISSANT-3"
    ],
    "attributes": {
      "packSize": "2 Pack"
    }
  },
  {
    "key": "PROD-PORTUGUESE-CUSTARD-TARTS-4PK",
    "title": "Authentic Pasteis de Nata Custard Tarts 4 Pack",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Sweet Meadow Patisserie",
    "shortDescription": "Crisp blistered puff pastry cups filled with caramelized egg custard.",
    "description": "Traditional Portuguese custard tarts with flaky crackling pastry and creamy vanilla cinnamon custard baked at high temperature for caramelized tops.",
    "basePrice": 82,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-NATA-TARTS-1",
      "CMA-PROD-NATA-TARTS-2",
      "CMA-PROD-NATA-TARTS-3"
    ],
    "attributes": {
      "packSize": "4 Pack"
    }
  },
  {
    "key": "PROD-IBUPROFEN-400MG-20TAB",
    "title": "Ibuprofen 400 mg Anti Inflammatory 20 Tablets",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "CarePlus Healthcare",
    "shortDescription": "Non-steroidal anti-inflammatory pain relief for muscular sprains.",
    "description": "Provides targeted relief from joint stiffness, back pain, dental inflammation and muscular swelling. Read package insert for dosage guidance.",
    "basePrice": 36,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-IBUPROFEN-1",
      "CMA-PROD-IBUPROFEN-2",
      "CMA-PROD-IBUPROFEN-3"
    ],
    "attributes": {
      "tabletCount": 20
    }
  },
  {
    "key": "PROD-MAGNESIUM-CHELATE-60CAP",
    "title": "High Absorption Magnesium Glycinate 60 Capsules",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Gentle chelated magnesium for muscular recovery and deep sleep.",
    "description": "Highly bioavailable magnesium glycinate formulated to ease muscular tension, nocturnal cramps and support relaxed nervous system recovery.",
    "basePrice": 185,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MAGNESIUM-1",
      "CMA-PROD-MAGNESIUM-2",
      "CMA-PROD-MAGNESIUM-3"
    ],
    "attributes": {
      "count": 60
    }
  },
  {
    "key": "PROD-TEA-TREE-OIL-20ML",
    "title": "Pure Organic Tea Tree Essential Oil 20 ml",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Antimicrobial essential oil for skin blemishes and scalp care.",
    "description": "Steam distilled from indigenous Melaleuca alternifolia leaves. Renowned for natural cleansing, skin blemish soothing and nail hygiene.",
    "basePrice": 68,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TEA-TREE-OIL-1",
      "CMA-PROD-TEA-TREE-OIL-2",
      "CMA-PROD-TEA-TREE-OIL-3"
    ],
    "attributes": {
      "volume": "20 ml"
    }
  },
  {
    "key": "PROD-ZINC-COMPLEX-60TAB",
    "title": "Immune Support Zinc and Vitamin D3 60 Tablets",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Synergistic combination of elemental zinc and active vitamin D3.",
    "description": "Helps maintain strong immune defence mechanisms, cellular energy and bone density throughout winter and busy working schedules.",
    "basePrice": 110,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ZINC-D3-1",
      "CMA-PROD-ZINC-D3-2",
      "CMA-PROD-ZINC-D3-3"
    ],
    "attributes": {
      "count": 60
    }
  },
  {
    "key": "PROD-EUCALYPTUS-RUB-100G",
    "title": "Soothing Herbal Eucalyptus Chest Vapor Rub 100 g",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Aromatic chest ointment with menthol, camphor and blue gum oil.",
    "description": "Provides cooling comforting vapors that ease breathing during seasonal colds, coughs and chest congestion. Gentle on family skin.",
    "basePrice": 44,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-EUCALYPTUS-RUB-1",
      "CMA-PROD-EUCALYPTUS-RUB-2",
      "CMA-PROD-EUCALYPTUS-RUB-3"
    ],
    "attributes": {
      "weight": "100 g"
    }
  },
  {
    "key": "PROD-HYDROCOLLOID-PLASTERS-10PK",
    "title": "Waterproof Hydrocolloid Blister Plasters 10 Pack",
    "categoryRef": "CC-FIRST-AID",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "SafeGuard Medical",
    "shortDescription": "Second-skin gel plasters that cushion and accelerate blister healing.",
    "description": "Flexible waterproof hydrocolloid dressings that absorb wound fluid while forming a protective barrier against footwear friction and water.",
    "basePrice": 54,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HYDROCOLLOID-1",
      "CMA-PROD-HYDROCOLLOID-2",
      "CMA-PROD-HYDROCOLLOID-3"
    ],
    "attributes": {
      "count": 10
    }
  },
  {
    "key": "PROD-ROOIBOS-SKIN-BALM-50G",
    "title": "Organic Rooibos and Calendula Rescue Balm 50 g",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Concentrated waterless balm for rough elbows, cuticles and dry patches.",
    "description": "Enriched with antioxidant-rich green rooibos extract, soothing calendula petals and cold-pressed sunflower oil for intense localized barrier repair.",
    "basePrice": 78,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-RESCUE-BALM-1",
      "CMA-PROD-RESCUE-BALM-2",
      "CMA-PROD-RESCUE-BALM-3"
    ],
    "attributes": {
      "weight": "50 g"
    }
  },
  {
    "key": "PROD-DIGESTIVE-ENZYMES-60CAP",
    "title": "Broad Spectrum Plant Digestive Enzymes 60 Capsules",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Comprehensive enzyme blend to support healthy comfortable digestion.",
    "description": "Formulated with bromelain, papain, amylase and lactase to assist breakdown of proteins, carbohydrates, fats and dairy sugars.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ENZYMES-1",
      "CMA-PROD-ENZYMES-2",
      "CMA-PROD-ENZYMES-3"
    ],
    "attributes": {
      "count": 60
    }
  }
];
