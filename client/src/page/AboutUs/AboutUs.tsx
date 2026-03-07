import { FC } from "react";
import { Link } from "react-router-dom";
import SmokeText from "../../shared/component/SmokeText/SmokeText";
import { ROUTES } from "../../shared/model/routes";
import "./style.css";

const items = [
  {
    id: 1,
    name: "Анастасия Рябых",
    social: "",
    img: "./actors/nastya.jpg",
  },
  {
    id: 2,
    name: "Виктория Юркова",
    social: "",
    img: "./actors/vica-2.jpg",
  },
  {
    id: 3,
    name: "Дмитрий Рыбочкин",
    social: "",
    img: "./actors/dima-2.jpg",
  },
  {
    id: 4,
    name: "Сандра Олейник",
    social: "",
    img: "./actors/sandra-2.jpg",
  },
  {
    id: 5,
    name: "Ксения",
    social: "",
    img: "./actors/ksysha-2.jpg",
  },
  {
    id: 6,
    name: "Александр Марченко",
    social: "",
    img: "./actors/sasha.jpg",
  },
  {
    id: 7,
    name: "Алена Паршина",
    social: "",
    img: "./actors/alena.jpg",
  },
  {
    id: 8,
    name: "Еатерина Слыххановская",
    social: "",
    img: "./actors/katya.jpg",
  },
  {
    id: 9,
    name: "Лилия Маркова",
    social: "",
    img: "./actors/lilya.jpg",
  },
  {
    id: 10,
    name: "Вероника Атушева",
    social: "",
    img: "./actors/nika.jpg",
  },
  {
    id: 11,
    name: "Сергей Луняка",
    social: "",
    img: "./actors/ya-2.jpg",
  },
  {
    id: 12,
    name: "Константин Горелкин не пришел на фотосессию",
    social: "",
    img: "./actors/kostya.png",
  },
];

const AboutUs: FC = () => {
  return (
    <div className="aboutus-page">
      <SmokeText text="" color={0x2d1b2e} />
      <Link to={ROUTES.HOME} className="back-arrow">
        Назад
      </Link>
      <div className="aboutus-page__content">
        <div className="aboutus-list">
          {items.map((data) => {
            return <Card data={data} />;
          })}
        </div>
      </div>
    </div>
  );
};

export const Component = AboutUs;

interface ICardProps {
  data: ICard;
}

interface ICard {
  name: string;
  img: string;
  social: string;
}

const Card: FC<ICardProps> = ({ data }) => {
  const { name, img } = data;

  return (
    <div className="aboutus-card">
      <div className="card-shadow"></div>
      <div className="image-wrapper">
        <img src={img} alt="paint" />
      </div>
      <div className="card-name">{name}</div>
    </div>
  );
};
