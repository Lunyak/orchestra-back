import { CallBotSettingsTrigger } from "../../call-bot/ui/CallBotSettingsTrigger";

export function TheaterRehearsalsHead() {
  return (
    <div className="theater-rehearsals-page__head">
      <div className="theater-rehearsals-page__title-row">
        <h1 className="rehearsals-title">Репетиции</h1>
        <CallBotSettingsTrigger className="theater-rehearsals-page__bot-btn" />
      </div>
    </div>
  );
}
