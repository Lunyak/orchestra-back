import { TheaterSectionNav } from "./TheaterSectionNav";

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
      </div>
    </div>
  );
}
