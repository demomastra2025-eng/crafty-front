"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, MapPin, Bed, Maximize2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
type BoundsResponse = {
  price: { min: number; max: number };
  priceM2: { min: number; max: number };
  floor: { min: number; max: number };
};

type EstateTypeId = "apartment" | "storage" | "parking";

type FlatRow = {
  id: number;
  complex_id: number | null;
  complex_name: string | null;
  address: string | null;
  rooms: number | null;
  area: number | string | null;
  price: number | null;
  price_m2: number | null;
  floor: number | null;
  floors_in_house: number | null;
  entrance: number | null;
  flat_number: string | null;
  title_image: string | null;
  status_name: string | null;
  is_reserved: boolean | null;
  is_sold: boolean | null;
  title: string | null;
  description: string | null;
  updated_at: string | null;
};

const estateTypes: { id: EstateTypeId; label: string; icon: string }[] = [
  { id: "apartment", label: "Квартира", icon: "🏢" },
  { id: "storage", label: "Кладовая", icon: "📦" },
  { id: "parking", label: "Паркинг", icon: "🚗" }
];

const PAGE_SIZE = 30;

export default function RealEstateListings() {
  const [complexOptions, setComplexOptions] = useState<
    { id: number | null; name: string }[]
  >([]);
  const [selectedComplexId, setSelectedComplexId] = useState<number | null>(null);

  const [selectedTypes, setSelectedTypes] = useState<EstateTypeId[]>([
    "apartment",
    "storage",
    "parking"
  ]);

  const [priceBounds, setPriceBounds] = useState<[number, number]>([0, 100_000_000]);
  const [priceM2Bounds, setPriceM2Bounds] = useState<[number, number]>([0, 1_000_000]);
  const [floorBounds, setFloorBounds] = useState<[number, number]>([1, 50]);

  const [priceRange, setPriceRange] = useState<[number, number]>(priceBounds);
  const [priceM2Range, setPriceM2Range] = useState<[number, number]>(priceM2Bounds);
  const [floorRange, setFloorRange] = useState<[number, number]>(floorBounds);
  const [floorFilterEnabled, setFloorFilterEnabled] = useState(false);

  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [searchText, setSearchText] = useState("");

  const [items, setItems] = useState<FlatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const placeholderImage = "/free-icon-house-building-9062738.png";

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-KZ", {
      style: "currency",
      currency: "KZT",
      maximumFractionDigits: 0
    }).format(price);

  const toggleFavorite = (propertyId: number) => {
    setFavorites((prev) =>
      prev.includes(propertyId) ? prev.filter((id) => id !== propertyId) : [...prev, propertyId]
    );
  };

  const toggleType = (typeId: EstateTypeId) =>
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );

  const toggleRoom = (roomCount: number) =>
    setSelectedRooms((prev) =>
      prev.includes(roomCount) ? prev.filter((count) => count !== roomCount) : [...prev, roomCount]
    );

  const classifyType = (row: FlatRow): EstateTypeId => {
    const hasRooms = row.rooms !== null && row.rooms !== undefined;
    const titleImage = (row.title_image || "").trim();
    if (hasRooms) return "apartment";
    if (!titleImage) return "storage";
    return "parking";
  };

  const resetFilters = () => {
    setSelectedTypes(["apartment", "storage", "parking"]);
    setPriceRange(priceBounds);
    setPriceM2Range(priceM2Bounds);
    setSelectedRooms([]);
    setFloorRange(floorBounds);
    setFloorFilterEnabled(false);
    setSearchText("");
    setSelectedComplexId(null);
  };

  async function loadComplexes() {
    const res = await fetch("/api/real-estate/complexes", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { id: number; name: string }[];
    setComplexOptions(data.map((d) => ({ id: d.id, name: d.name })));
  }

  async function loadBounds() {
    const res = await fetch("/api/real-estate/bounds", { cache: "no-store" });
    if (!res.ok) return;
    const b = (await res.json()) as BoundsResponse;
    setPriceBounds([b.price.min, b.price.max]);
    setPriceM2Bounds([b.priceM2.min, b.priceM2.max]);
    setFloorBounds([b.floor.min, b.floor.max]);
    setPriceRange([b.price.min, b.price.max]);
    setPriceM2Range([b.priceM2.min, b.priceM2.max]);
    setFloorRange([b.floor.min, b.floor.max]);
  }

  async function loadPage(nextPage: number, reset = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("minPrice", String(priceRange[0]));
      params.set("maxPrice", String(priceRange[1]));
      params.set("minPriceM2", String(priceM2Range[0]));
      params.set("maxPriceM2", String(priceM2Range[1]));
      if (selectedComplexId !== null) params.set("complexId", String(selectedComplexId));
      if (searchText.trim()) params.set("search", searchText.trim());
      if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
      if (selectedRooms.length > 0) params.set("rooms", selectedRooms.join(","));
      if (floorFilterEnabled) {
        params.set("floorMin", String(floorRange[0]));
        params.set("floorMax", String(floorRange[1]));
      }

      const res = await fetch(`/api/real-estate/flats?${params.toString()}`, {
        cache: "no-store"
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: FlatRow[]; hasMore: boolean };
      setHasMore(data.hasMore);
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplexes();
    loadBounds().then(() => loadPage(0, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadPage(0, true);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRange, priceM2Range, searchText, selectedComplexId]);

  const filteredItems = useMemo(() => items, [items]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Filters */}
      <div className="w-80 border-r bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div>
            <h2 className="mb-4 text-lg font-semibold">Фильтры</h2>

            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Поиск</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  id="search"
                  placeholder="ЖК, адрес, название..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Property Type */}
          <div>
            <h3 className="mb-3 font-medium">Тип недвижимости</h3>
            <div className="grid grid-cols-2 gap-2">
              {estateTypes.map((type) => (
                <Button
                  key={type.id}
                  variant={selectedTypes.includes(type.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleType(type.id)}
                  className="h-auto flex-col justify-start gap-1 p-3">
                  <span className="text-lg">{type.icon}</span>
                  <span className="text-xs">{type.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Complex */}
          <div>
            <h3 className="mb-3 font-medium">Жилой комплекс</h3>
            <Select
              value={selectedComplexId === null ? "all" : String(selectedComplexId)}
              onValueChange={(value) =>
                setSelectedComplexId(value === "all" ? null : Number(value))
              }>
              <SelectTrigger>
                <SelectValue placeholder="Все ЖК" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ЖК</SelectItem>
                {complexOptions.map((c) => (
                  <SelectItem
                    key={`${c.id ?? "name"}-${c.name}`}
                    value={c.id === null ? "all" : String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="mb-3 font-medium">Цена (₸)</h3>
            <div className="px-2">
              <Slider
                value={priceRange as number[]}
                onValueChange={(v) => setPriceRange([v[0], v[1]])}
                max={priceBounds[1]}
                min={priceBounds[0]}
                step={100_000}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{formatPrice(priceRange[0])}</span>
                <span>{formatPrice(priceRange[1])}</span>
              </div>
            </div>
          </div>

          {/* Price per m2 */}
          <div>
            <h3 className="mb-3 font-medium">Цена за м² (₸/м²)</h3>
            <div className="px-2">
              <Slider
                value={priceM2Range as number[]}
                onValueChange={(v) => setPriceM2Range([v[0], v[1]])}
                max={priceM2Bounds[1]}
                min={priceM2Bounds[0]}
                step={10_000}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{formatPrice(priceM2Range[0]).replace("₸", "₸/м²")}</span>
                <span>{formatPrice(priceM2Range[1]).replace("₸", "₸/м²")}</span>
              </div>
            </div>
          </div>

          {/* Rooms */}
          <div>
            <h3 className="mb-3 font-medium">Комнат</h3>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((room) => (
                <Button
                  key={room}
                  variant={selectedRooms.includes(room) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRoom(room)}
                  className="h-10 w-10">
                  {room}к
                </Button>
              ))}
              <Button
                variant={selectedRooms.length === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRooms([])}
                className="h-10">
                Любые
              </Button>
            </div>
          </div>

          {/* Floor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">Этаж</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFloorFilterEnabled((v) => !v)}>
                {floorFilterEnabled ? "Вкл" : "Выкл"}
              </Button>
            </div>
            <div className="px-2">
              <Slider
                value={floorRange as number[]}
                onValueChange={(v) => {
                  setFloorRange([v[0], v[1]]);
                  setFloorFilterEnabled(true);
                }}
                max={floorBounds[1]}
                min={floorBounds[0]}
                step={1}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{floorRange[0]}</span>
                <span>{floorRange[1]}</span>
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full bg-transparent" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Найдено {filteredItems.length} объекта</h1>
        </div>

        <div className="space-y-6">
          {filteredItems.map((property) => {
            const typeId = classifyType(property);
            const typeLabel = estateTypes.find((t) => t.id === typeId)?.label || "Объект";
            const isFeatured = property.is_reserved || property.is_sold;
            const areaValue =
              property.area === null || property.area === undefined
                ? null
                : typeof property.area === "string"
                  ? Number(property.area)
                  : property.area;
            return (
              <Card
                key={property.id}
                className="overflow-hidden transition-shadow hover:shadow-lg">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="relative h-48 w-80">
                      <img
                        src={property.title_image || placeholderImage}
                        alt={property.title || property.complex_name || "Недвижимость"}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = placeholderImage;
                        }}
                      />
                      <Badge className="absolute top-3 left-3 bg-blue-600">{typeLabel}</Badge>
                      {property.is_sold && (
                        <Badge className="absolute top-3 right-3 bg-red-600">Продано</Badge>
                      )}
                      {property.is_reserved && !property.is_sold && (
                        <Badge className="absolute top-3 right-3 bg-amber-600">Бронь</Badge>
                      )}
                    </div>

                    <div className="flex flex-1 justify-between p-6">
                      <div className="space-y-3">
                        {(property.address || property.complex_name) && (
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="mr-1 h-4 w-4" />
                            {[property.complex_name, property.address]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}

                        <h3 className="text-xl font-semibold">
                          {property.title || property.complex_name || "Объект недвижимости"}
                        </h3>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          {property.rooms !== null && (
                            <div className="flex items-center gap-1">
                              <Bed className="h-4 w-4" />
                              {property.rooms} комнат
                            </div>
                          )}
                          {property.floor !== null &&
                            property.floors_in_house !== null && (
                              <div className="text-sm">
                                Этаж {property.floor}/{property.floors_in_house}
                              </div>
                            )}
                          {property.flat_number && (
                            <div className="text-sm">№ {property.flat_number}</div>
                          )}
                        </div>

                        {areaValue !== null && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Maximize2 className="h-4 w-4" />
                            {areaValue} м²
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(property.id)}
                          className="p-2">
                          <Heart
                            className={`h-5 w-5 ${
                              favorites.includes(property.id)
                                ? "fill-red-500 text-red-500"
                                : "text-gray-400"
                            }`}
                          />
                        </Button>

                        <div className="text-right">
                          {typeof property.price === "number" && (
                            <div className="text-2xl font-bold">
                              {formatPrice(property.price)}
                            </div>
                          )}
                          {typeof property.price_m2 === "number" && (
                            <div className="mt-1 text-sm text-gray-600">
                              {formatPrice(property.price_m2).replace("₸", "₸/м²")}
                            </div>
                          )}
                          {isFeatured && property.status_name && (
                            <div className="mt-1 text-xs text-gray-500">
                              {property.status_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredItems.length === 0 && !loading && (
            <div className="rounded-lg border bg-transparent p-6 text-center text-gray-600">
              По вашим фильтрам ничего не найдено.
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => loadPage(page + 1, false)}>
                {loading ? "Загрузка..." : "Eщё"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
