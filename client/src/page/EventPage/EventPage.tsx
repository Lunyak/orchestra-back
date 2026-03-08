/* eslint-disable no-useless-escape */
import { FC, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Controller, Navigation } from "swiper/modules";
import { Swiper, SwiperClass, SwiperSlide } from "swiper/react";
import { ROUTES } from "../../shared/model/routes";
import "./style.css";

const EVENTS = [
  {
    id: "1",
    soon: false,
    name: "",
    subtitle: "",
    old: "",
    anonse:
      'Это не просто история о прошлом. Это размышление о времени, идеологии и вечных вопросах: что важнее — семья, долг или личные убеждения? Наш спектакль поставлен по второй редакции пьесы — последней работе Горького. Это рассказ о схватке между старым и новым, где каждая сторона по-своему права и по-своему несчастна. Железнова — сильная, но одинокая женщина. Она продолжает жить "как положено", сохраняя семейное дело и защищая его от любых угроз. Её жизнь — как пароход: идёт вперёд, не жалея себя и других. Её философия проста: "Дети — руки мои, внуки — пальцы мои". Она верит, что её долг — сохранить груз прошлого, чтобы передать его в будущее. Но её дети — это уже другое время, другие идеи. Между ними разворачивается схватка за смысл жизни, за право на своё будущее. Символом этого будущего становится маленький Коля, сын Рахиль и внук Вассы. За него борются идеалы двух эпох.',
    date: "",
    img: "vassa-afisha.jpg",
    type: "",
    colorBackground: 0x6b0f1a,
    photos: [
      "/photos/vassa/0.jpg",
      "/photos/vassa/1.jpg",
      "/photos/vassa/2.jpg",
      "/photos/vassa/3.jpg",
      "/photos/vassa/4.jpg",
      "/photos/vassa/5.jpg",
      "/photos/vassa/6.jpg",
      "/photos/vassa/7.jpg",
      "/photos/vassa/8.jpg",
      "/photos/vassa/9.jpg",
      "/photos/vassa/10.jpg",
      "/photos/vassa/12.jpg",
      "/photos/vassa/13.jpg",
      "/photos/vassa/14.jpg",
    ],
  },
  {
    id: "2",
    soon: false,
    name: "",
    subtitle: "",
    old: "",
    type: "",
    anonse:
      'Комедия в двух действиях по пьесе Нила Саймона \"Дураки\" Леон Степанович, молодой учитель, приезжает в глухую деревню в надежде раскрыть весь свой потенциал. Он действует по приглашению местного доктора Зубрицкого, который мечтает, чтобы его дочь получила образование. На первый взгляд — совершенно обычная история. Но всё меняется с первых минут. Леон замечает странности в поведении местных жителей: другие учителя почему-то не задерживаются дольше суток, а в самой деревне витает что-то... неладное. Доктор Зубрицкий раскрывает тайну: вот уже 200 лет все жители деревни рождаются и умирают дураками — из-за страшного и древнего заклятия. Если Леон не уедет в течение 24 часов, то и сам навсегда потеряет разум.Он собирается уехать, но... влюбляется в дочь доктора. Теперь перед ним стоит выбор: либо он научит деревню хоть чему-то, либо навсегда останется одним из них. А времени — всё меньше.',
    date: "",
    img: "afisha-2.jpg",
    colorBackground: 0x01172f,
    photos: [
      "/photos/fools/0.jpg",
      "/photos/fools/1.jpg",
      "/photos/fools/2.jpg",
      "/photos/fools/3.jpg",
      "/photos/fools/5.jpg",
      "/photos/fools/6.jpg",
      "/photos/fools/7.jpg",
      "/photos/fools/8.jpg",
    ],
  },
  {
    id: "3",
    soon: true,
    name: "Зойкина квартирка",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "февраль",
    img: "https://i.pinimg.com/736x/6c/de/d0/6cded009506170d47a5865ae6854bcf4.jpg",
    colorBackground: 0x6b0f1a,
    photos: ["/images/show1.jpg", "/images/show2.jpg", "/images/show3.jpg"],
  },
  {
    id: "4",
    soon: true,
    name: "Чехов Дуэль",
    subtitle: "Узнать больше",
    old: "18+",
    type: "трагикомедия",
    anonse: "",
    date: "март",
    img: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1583&q=80",
    colorBackground: 0x6b0f1a,
    photos: ["/images/show1.jpg", "/images/show2.jpg", "/images/show3.jpg"],
  },
];

const EventPage: FC = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const goBack = () => {
    navigate(-1);
  };

  const curentEvent = EVENTS.find((E) => E.id === eventId);

  if (!curentEvent) {
    return <div>Событие не найдено</div>;
  }

  return (
    <div>
      <div className="event-page__background">
      </div>

      <Link onClick={goBack} to={ROUTES.EVENTS} className="back-arrow">
        Назад
      </Link>

      <div className="event-page__content">
        <div className="event-page__header"></div>

        <div className="event-page__main">
          {/* Основной слайдер вместо одного img */}
          <div className="event-page__image">
            <PhotoCarousel images={curentEvent.photos} />
          </div>

          <div className="event-page__description">{curentEvent.anonse}</div>
        </div>

        {/* Можно оставить миниатюры в футере */}
        <div className="event-page__footer">
          {/* Миниатюры можно либо сюда, либо внутри PhotoCarousel */}
        </div>
      </div>
    </div>
  );
};

export const Component = EventPage;

interface PhotoCarouselProps {
  images: string[];
}

function PhotoCarousel({ images }: PhotoCarouselProps) {
  const [mainSwiper, setMainSwiper] = useState<SwiperClass | null>(null);
  const [thumbSwiper, setThumbSwiper] = useState<SwiperClass | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      {/* Основной слайдер */}
      <Swiper
        modules={[Controller]}
        onSwiper={setMainSwiper}
        controller={{ control: thumbSwiper }}
        spaceBetween={10}
        slidesPerView={1}
        loop={true}
        onSlideChange={(swiper: SwiperClass) =>
          setActiveIndex(swiper.realIndex)
        }
        style={{ width: "100%", height: "700px", maxWidth: "600px" }}
      >
        {images.map((src, index) => (
          <SwiperSlide key={index}>
            <img
              src={src}
              alt={`Фото ${index + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: "10px",
              }}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Миниатюрный слайдер */}
      <Swiper
        modules={[Navigation, Controller]}
        onSwiper={setThumbSwiper}
        controller={{ control: mainSwiper }} // <- теперь нижний управляет верхним
        spaceBetween={10}
        slidesPerView={4}
        navigation
        // loop={true}
        slideToClickedSlide={true} // клики по миниатюрам меняют большой слайд
        style={{ width: "100%", height: "100px", marginTop: "10px" }}
      >
        {images.map((src, index) => (
          <SwiperSlide key={index} style={{ cursor: "pointer" }}>
            <img
              src={src}
              alt={`Миниатюра ${index + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "5px",
                border:
                  index === activeIndex
                    ? "2px solid #fff"
                    : "2px solid transparent",
                boxSizing: "border-box",
              }}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}

export default PhotoCarousel;
