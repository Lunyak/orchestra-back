import { TheaterSectionNav } from "./TheaterSectionNav";
import { CallBotSettingsTrigger } from "../../call-bot/ui/CallBotSettingsTrigger";

type TheaterRehearsalsHeadProps = {
  theaterId: string;
};

export function TheaterRehearsalsHead({ theaterId }: TheaterRehearsalsHeadProps) {
  return (
    <div className="theater-rehearsals-page__head">
      <div className="theater-rehearsals-page__title-row">
        <TheaterSectionNav
          theaterId={theaterId}
          active="rehearsals"
          variant="inline"
        />
        <h1 className="rehearsals-title">Репетиции</h1>
        <CallBotSettingsTrigger className="theater-rehearsals-page__bot-btn" />
      </div>
    </div>
  );
}
