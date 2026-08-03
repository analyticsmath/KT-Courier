import { ClosingScene } from "./ClosingScene";
import { CoverageScene } from "./CoverageScene";
import { DocumentaryRail } from "./DocumentaryRail";
import { HeroScene } from "./HeroScene";
import { HomepageFaq, type HomepageFaqItem } from "./HomepageFaq";
import { JoinNetworkScene } from "./JoinNetworkScene";
import { MarketplacePreview } from "./MarketplacePreview";
import { NetworkScene } from "./NetworkScene";
import { OperationalControlScene } from "./OperationalControlScene";
import { ServiceSpectrum } from "./ServiceSpectrum";
import { HomepageMotionController } from "@/components/public-v2/motion";
import { homepageMedia } from "@/lib/public-assets/homepage-media";

export function HomepageV2({ faqItems }: { faqItems: readonly HomepageFaqItem[] }) {
  return (
    <div data-kt-homepage="v2" id="kt-homepage-v2">
      <HomepageMotionController heroTreatment={homepageMedia.hero.vehicle.motionTreatment} rootId="kt-homepage-v2" />
      <HeroScene />
      <DocumentaryRail />
      <ServiceSpectrum />
      <NetworkScene />
      <CoverageScene />
      <MarketplacePreview />
      <OperationalControlScene />
      <JoinNetworkScene />
      <HomepageFaq items={faqItems} />
      <ClosingScene />
    </div>
  );
}
