
CREATE POLICY "loads_update_demo" ON public.loads FOR UPDATE TO authenticated
  USING (is_demo = true) WITH CHECK (is_demo = true);

CREATE POLICY "trucks_update_demo" ON public.trucks FOR UPDATE TO authenticated
  USING (is_demo = true) WITH CHECK (is_demo = true);

CREATE POLICY "bookings_read_demo" ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loads l WHERE l.id = load_id AND l.is_demo = true));

CREATE POLICY "bookings_update_demo" ON public.bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loads l WHERE l.id = load_id AND l.is_demo = true))
  WITH CHECK (true);
