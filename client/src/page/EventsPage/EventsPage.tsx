import { FC } from "react";
import { Link } from "react-router-dom";
import SmokeText from "../../shared/component/SmokeText/SmokeText";
import { ROUTES } from "../../shared/model/routes";
import "./style.css";

const items = [
  {
    id: '1',
    soon: false,
    name: "",
    subtitle: "",
    old: "",
    anonse: "",
    date: "",
    img: "vassa-afisha.jpg",
    type: "",
  },
  {
    id: '2',
    soon: false,
    name: "",
    subtitle: "",
    old: "",
    type: "",
    anonse: '"',
    date: "",
    img: "afisha-2.jpg",
  },
  {
    id: '3',
    soon: true,
    name: "Зойкина квартирка",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "февраль",
    img: "https://i.pinimg.com/736x/6c/de/d0/6cded009506170d47a5865ae6854bcf4.jpg",
  },
  {
    id: '4',
    soon: true,
    name: "Чехов Дуэль",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "март",
    img: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1583&q=80",
  },
];

const EventsPage: FC = () => {
  return (
    <div className="events-page">
      <div className="events-page__background">
        <SmokeText text="" color={0x2d1b2e} />
      </div>
      <div className="events-page__content">
        <Link to={ROUTES.HOME} className="arrow-back">
          Назад
        </Link>

        <div className="events-list">
          {items.map((data) => {
            return <Card data={data} />;
          })}
        </div>
      </div>
    </div>
  );
};

export const Component = EventsPage;

interface ICardProps {
  data: ICard;
}

interface ICard {
  name: string;
  img: string;
  subtitle: string;
  old: string;
  type: string;
  anonse: string;
  date: string;
  soon: boolean;
  id: string;
}

const Card: FC<ICardProps> = ({ data }) => {
  const { name, img, old, type, anonse, date, soon, id } = data;

  return (
    <Link to={id} className="card">
      {soon && <div className="shadow"></div>}
      <div className="image-wrapper">
        <img src={img} alt="paint" />
      </div>
      <div className="card-header">
        {soon && <div className="card-soon">скоро</div>}
        <div className="card-old">{old}</div>
      </div>

      <div className="card-date">
        <span className="card-date__date">{date}</span>
      </div>

      <div className="card-name">
        <h1>{name}</h1>
      </div>

      <hr />

      <div className="card-anonse">
        <h2>{anonse}</h2>
      </div>

      <div className="card-type">
        <h2>{type}</h2>
      </div>
      {!soon && (
        <div className="know-more">
          <button className="">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12.3323 1H1.31467V1.6672H11.8697L1 12.5283L1.47225 13L12.3323 2.14859V12.6761H13V1.6672V1H12.3323Z"></path>
            </svg>
          </button>
        </div>
      )}
    </Link>
  );
};
