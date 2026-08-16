
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('DRIVER','SHIPPER','ADMIN');

-- helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'DRIVER',
  language TEXT NOT NULL DEFAULT 'en',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.app_role;
BEGIN
  BEGIN r := COALESCE(NEW.raw_user_meta_data->>'role','DRIVER')::public.app_role;
  EXCEPTION WHEN others THEN r := 'DRIVER'; END;
  INSERT INTO public.profiles (id, name, email, phone, role, language)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
          NEW.email,
          NEW.raw_user_meta_data->>'phone',
          r,
          COALESCE(NEW.raw_user_meta_data->>'language','en'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  IF r = 'DRIVER' THEN
    INSERT INTO public.drivers (user_id, name, phone) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name','Driver'), NEW.raw_user_meta_data->>'phone');
  ELSIF r = 'SHIPPER' THEN
    INSERT INTO public.shippers (user_id, company_name, phone) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', NEW.raw_user_meta_data->>'name','Business'), NEW.raw_user_meta_data->>'phone');
  END IF;
  RETURN NEW;
END; $$;

-- DRIVERS
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  language TEXT DEFAULT 'hi',
  truck_type TEXT,
  capacity NUMERIC,
  vehicle_model TEXT,
  fuel_type TEXT DEFAULT 'DIESEL',
  preferred_routes JSONB DEFAULT '[]'::jsonb,
  current_lat NUMERIC, current_lng NUMERIC,
  trust_score NUMERIC NOT NULL DEFAULT 4.2,
  completed_trips INTEGER NOT NULL DEFAULT 0,
  return_loads_found INTEGER NOT NULL DEFAULT 0,
  empty_km_avoided NUMERIC NOT NULL DEFAULT 0,
  additional_income NUMERIC NOT NULL DEFAULT 0,
  kyc_status TEXT NOT NULL DEFAULT 'PENDING',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT SELECT ON public.drivers TO anon;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_read_all" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "drivers_insert_own" ON public.drivers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "drivers_update_own" ON public.drivers FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN')) WITH CHECK (true);
CREATE TRIGGER drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SHIPPERS
CREATE TABLE public.shippers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  business_type TEXT,
  phone TEXT,
  verification_status TEXT NOT NULL DEFAULT 'PENDING',
  trust_score NUMERIC NOT NULL DEFAULT 4.3,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shippers TO authenticated;
GRANT SELECT ON public.shippers TO anon;
GRANT ALL ON public.shippers TO service_role;
ALTER TABLE public.shippers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shippers_read_all" ON public.shippers FOR SELECT USING (true);
CREATE POLICY "shippers_insert_own" ON public.shippers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "shippers_update_own" ON public.shippers FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN')) WITH CHECK (true);

-- TRUCKS
CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  truck_type TEXT NOT NULL DEFAULT '10-Wheeler',
  capacity NUMERIC NOT NULL DEFAULT 10,
  vehicle_model TEXT,
  fuel_type TEXT DEFAULT 'DIESEL',
  current_lat NUMERIC, current_lng NUMERIC,
  destination_city TEXT,
  destination_lat NUMERIC, destination_lng NUMERIC,
  available_from TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  verified BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trucks TO authenticated;
GRANT SELECT ON public.trucks TO anon;
GRANT ALL ON public.trucks TO service_role;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trucks_read_all" ON public.trucks FOR SELECT USING (true);
CREATE POLICY "trucks_write_own" ON public.trucks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "trucks_update_own" ON public.trucks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.has_role(auth.uid(),'ADMIN')) WITH CHECK (true);
CREATE INDEX idx_trucks_status ON public.trucks(status);
CREATE INDEX idx_trucks_pos ON public.trucks(current_lat, current_lng);
CREATE TRIGGER trucks_updated BEFORE UPDATE ON public.trucks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LOADS
CREATE TABLE public.loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id UUID REFERENCES public.shippers(id) ON DELETE CASCADE,
  pickup_location TEXT NOT NULL,
  pickup_lat NUMERIC NOT NULL, pickup_lng NUMERIC NOT NULL,
  delivery_location TEXT NOT NULL,
  delivery_lat NUMERIC NOT NULL, delivery_lng NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,
  cargo_type TEXT NOT NULL DEFAULT 'General',
  truck_type TEXT NOT NULL DEFAULT '10-Wheeler',
  budget NUMERIC NOT NULL,
  pickup_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'POSTED',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loads TO authenticated;
GRANT SELECT ON public.loads TO anon;
GRANT ALL ON public.loads TO service_role;
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loads_read_all" ON public.loads FOR SELECT USING (true);
CREATE POLICY "loads_insert_own" ON public.loads FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()));
CREATE POLICY "loads_update_own" ON public.loads FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()) OR public.has_role(auth.uid(),'ADMIN')) WITH CHECK (true);
CREATE POLICY "loads_delete_own" ON public.loads FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()));
CREATE INDEX idx_loads_status ON public.loads(status);
CREATE INDEX idx_loads_pickup_time ON public.loads(pickup_time);
CREATE INDEX idx_loads_pickup_pos ON public.loads(pickup_lat, pickup_lng);
CREATE TRIGGER loads_updated BEFORE UPDATE ON public.loads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RETURN LOAD OPPORTUNITIES
CREATE TABLE public.return_load_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE,
  match_score NUMERIC NOT NULL,
  route_score NUMERIC, distance_score NUMERIC, capacity_score NUMERIC,
  timing_score NUMERIC, price_score NUMERIC, trust_score NUMERIC,
  estimated_earning NUMERIC, empty_km_avoided NUMERIC,
  estimated_fuel_saved NUMERIC, estimated_co2_avoided NUMERIC,
  reasons JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_load_opportunities TO authenticated;
GRANT SELECT ON public.return_load_opportunities TO anon;
GRANT ALL ON public.return_load_opportunities TO service_role;
ALTER TABLE public.return_load_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rlo_read_all" ON public.return_load_opportunities FOR SELECT USING (true);
CREATE POLICY "rlo_write_auth" ON public.return_load_opportunities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rlo_update_auth" ON public.return_load_opportunities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_rlo_truck ON public.return_load_opportunities(truck_id);
CREATE INDEX idx_rlo_score ON public.return_load_opportunities(match_score DESC);

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  shipper_id UUID REFERENCES public.shippers(id) ON DELETE SET NULL,
  agreed_rate NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  empty_km_avoided NUMERIC DEFAULT 0,
  fuel_saved NUMERIC DEFAULT 0,
  co2_avoided NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_read_party" ON public.bookings FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid())
);
CREATE POLICY "bookings_insert_auth" ON public.bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bookings_update_party" ON public.bookings FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid())
) WITH CHECK (true);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRIPS
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  start_location TEXT, destination TEXT,
  start_lat NUMERIC, start_lng NUMERIC,
  destination_lat NUMERIC, destination_lng NUMERIC,
  estimated_arrival TIMESTAMPTZ, actual_arrival TIMESTAMPTZ,
  progress NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'BOOKED',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trips TO authenticated;
GRANT SELECT ON public.trips TO anon;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_read_all" ON public.trips FOR SELECT USING (true);
CREATE POLICY "trips_write_auth" ON public.trips FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "trips_update_auth" ON public.trips FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_type TEXT NOT NULL DEFAULT 'ADVANCE',
  status TEXT NOT NULL DEFAULT 'PENDING',
  razorpay_order_id TEXT, razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_party" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b
    LEFT JOIN public.drivers d ON d.id = b.driver_id
    LEFT JOIN public.shippers s ON s.id = b.shipper_id
    WHERE b.id = booking_id AND (d.user_id = auth.uid() OR s.user_id = auth.uid()))
  OR public.has_role(auth.uid(),'ADMIN')
);
CREATE POLICY "payments_insert_auth" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payments_update_auth" ON public.payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- LOCATION UPDATES
CREATE TABLE public.location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  lat NUMERIC NOT NULL, lng NUMERIC NOT NULL,
  speed NUMERIC, heading NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.location_updates TO authenticated;
GRANT SELECT ON public.location_updates TO anon;
GRANT ALL ON public.location_updates TO service_role;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_read_all" ON public.location_updates FOR SELECT USING (true);
CREATE POLICY "loc_insert_owner" ON public.location_updates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.trucks t JOIN public.drivers d ON d.id = t.driver_id WHERE t.id = truck_id AND d.user_id = auth.uid())
);
CREATE INDEX idx_loc_truck ON public.location_updates(truck_id);
CREATE INDEX idx_loc_time ON public.location_updates(timestamp DESC);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT,
  type TEXT NOT NULL DEFAULT 'INFO',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RATINGS
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  communication INTEGER, on_time INTEGER, professionalism INTEGER, payment_reliability INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT SELECT ON public.ratings TO anon;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_read_all" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_own" ON public.ratings FOR INSERT TO authenticated WITH CHECK (rater_id = auth.uid());

-- PILOT VALIDATION
CREATE TABLE public.pilot_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pilot_validation TO anon, authenticated;
GRANT ALL ON public.pilot_validation TO service_role;
ALTER TABLE public.pilot_validation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilot_read_all" ON public.pilot_validation FOR SELECT USING (true);

-- signup trigger (after drivers/shippers exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_updates;

-- ============ DEMO SEED ============
INSERT INTO public.shippers (id, company_name, business_type, phone, verification_status, trust_score, is_demo) VALUES
 ('11111111-1111-1111-1111-111111111101','Narmada FMCG Distributors','FMCG','+91 90000 11101','VERIFIED',4.6,true),
 ('11111111-1111-1111-1111-111111111102','Malwa Steel Traders','Steel','+91 90000 11102','VERIFIED',4.4,true),
 ('11111111-1111-1111-1111-111111111103','Bhopal Agro Exports','Agri','+91 90000 11103','VERIFIED',4.1,true),
 ('11111111-1111-1111-1111-111111111104','Vidarbha Cement Co','Cement','+91 90000 11104','PENDING',3.9,true),
 ('11111111-1111-1111-1111-111111111105','Pune Auto Parts Ltd','Automotive','+91 90000 11105','VERIFIED',4.7,true);

INSERT INTO public.drivers (id, name, phone, language, truck_type, capacity, vehicle_model, current_lat, current_lng, trust_score, completed_trips, return_loads_found, empty_km_avoided, additional_income, kyc_status, is_demo) VALUES
 ('22222222-2222-2222-2222-222222222201','Rajesh Yadav','+91 98000 22201','hi','10-Wheeler',10,'Tata Signa 2818',22.5,79.2,4.8,142,38,41200,742000,'VERIFIED',true),
 ('22222222-2222-2222-2222-222222222202','Sukhwinder Singh','+91 98000 22202','hi','12-Wheeler',16,'Ashok Leyland 3118',23.2,77.4,4.5,96,21,18400,398000,'VERIFIED',true),
 ('22222222-2222-2222-2222-222222222203','Mohan Patil','+91 98000 22203','mr','6-Wheeler',7,'Eicher Pro 3019',21.1,79.05,4.2,64,12,9100,204000,'PENDING',true),
 ('22222222-2222-2222-2222-222222222204','Imran Khan','+91 98000 22204','hi','10-Wheeler',10,'BharatBenz 2823',22.72,75.86,4.6,110,27,23800,512000,'VERIFIED',true);

INSERT INTO public.trucks (id, driver_id, registration_number, truck_type, capacity, vehicle_model, current_lat, current_lng, destination_city, destination_lat, destination_lng, available_from, status, verified, is_demo) VALUES
 ('33333333-3333-3333-3333-333333333301','22222222-2222-2222-2222-222222222201','RJ14 AB 1234','10-Wheeler',10,'Tata Signa 2818',21.9,78.4,'Jabalpur',23.1815,79.9864, now() + interval '1 day', 'EMPTY_SOON', true, true),
 ('33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222202','MP09 CD 5678','12-Wheeler',16,'Ashok Leyland 3118',23.2599,77.4126,'Bhopal',23.2599,77.4126, now() + interval '6 hours','EMPTY_SOON', true, true),
 ('33333333-3333-3333-3333-333333333303','22222222-2222-2222-2222-222222222203','MH31 EF 9012','6-Wheeler',7,'Eicher Pro 3019',21.1458,79.0882,'Nagpur',21.1458,79.0882, now(), 'AVAILABLE', true, true),
 ('33333333-3333-3333-3333-333333333304','22222222-2222-2222-2222-222222222204','MP13 GH 3456','10-Wheeler',10,'BharatBenz 2823',22.7196,75.8577,'Indore',22.7196,75.8577, now() + interval '2 days','IN_TRANSIT', true, true);

INSERT INTO public.loads (id, shipper_id, pickup_location, pickup_lat, pickup_lng, delivery_location, delivery_lat, delivery_lng, weight, cargo_type, truck_type, budget, pickup_time, status, is_demo) VALUES
 ('44444444-4444-4444-4444-444444444401','11111111-1111-1111-1111-111111111101','Jabalpur',23.1815,79.9864,'Indore',22.7196,75.8577,8,'FMCG','10-Wheeler',24000, now() + interval '1 day 15 hours','POSTED',true),
 ('44444444-4444-4444-4444-444444444402','11111111-1111-1111-1111-111111111102','Jabalpur',23.2100,79.9500,'Bhopal',23.2599,77.4126,7,'Steel','10-Wheeler',21000, now() + interval '1 day 18 hours','POSTED',true),
 ('44444444-4444-4444-4444-444444444403','11111111-1111-1111-1111-111111111104','Jabalpur',23.1500,80.0300,'Nagpur',21.1458,79.0882,10,'Cement','10-Wheeler',26000, now() + interval '2 days','POSTED',true),
 ('44444444-4444-4444-4444-444444444404','11111111-1111-1111-1111-111111111103','Bhopal',23.2599,77.4126,'Pune',18.5204,73.8567,12,'Agri Produce','12-Wheeler',38000, now() + interval '1 day','POSTED',true),
 ('44444444-4444-4444-4444-444444444405','11111111-1111-1111-1111-111111111105','Nagpur',21.1458,79.0882,'Mumbai',19.0760,72.8777,9,'Auto Parts','10-Wheeler',34000, now() + interval '3 days','POSTED',true),
 ('44444444-4444-4444-4444-444444444406','11111111-1111-1111-1111-111111111101','Indore',22.7196,75.8577,'Ahmedabad',23.0225,72.5714,6,'FMCG','6-Wheeler',22000, now() + interval '2 days','POSTED',true),
 ('44444444-4444-4444-4444-444444444407','11111111-1111-1111-1111-111111111102','Jabalpur',23.1000,79.9000,'Jaipur',26.9124,75.7873,14,'Steel','12-Wheeler',52000, now() + interval '2 days 6 hours','POSTED',true),
 ('44444444-4444-4444-4444-444444444408','11111111-1111-1111-1111-111111111103','Bhopal',23.3000,77.3500,'Delhi',28.6139,77.2090,11,'Agri Produce','12-Wheeler',48000, now() + interval '4 days','POSTED',true);

INSERT INTO public.trips (truck_id, start_location, destination, start_lat, start_lng, destination_lat, destination_lng, estimated_arrival, progress, status, is_demo) VALUES
 ('33333333-3333-3333-3333-333333333301','Mumbai','Jabalpur',19.0760,72.8777,23.1815,79.9864, now() + interval '1 day 6 hours', 62, 'IN_TRANSIT', true);

INSERT INTO public.pilot_validation (metric, value, notes) VALUES
 ('drivers_interviewed',24,'Jabalpur corridor pilot'),
 ('shippers_interviewed',11,'Jabalpur / Indore'),
 ('loads_posted',36,'Demo + pilot'),
 ('return_loads_matched',19,'Demo + pilot'),
 ('bookings_completed',7,'Pilot only'),
 ('avg_empty_km_avoided',870,'Estimated'),
 ('avg_additional_income',21500,'Estimated');

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "loads_update_demo" ON public.loads FOR UPDATE TO authenticated
  USING (is_demo = true) WITH CHECK (is_demo = true);

CREATE POLICY "trucks_update_demo" ON public.trucks FOR UPDATE TO authenticated
  USING (is_demo = true) WITH CHECK (is_demo = true);

CREATE POLICY "bookings_read_demo" ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loads l WHERE l.id = load_id AND l.is_demo = true));

CREATE POLICY "bookings_update_demo" ON public.bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loads l WHERE l.id = load_id AND l.is_demo = true))
  WITH CHECK (true);
